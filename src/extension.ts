// Use legacy style importing to work around standard imports not available in files loaded by the shell, those can't be modules (yet)
// > Note that as of GNOME 44, neither GNOME Shell nor Extensions support ESModules, and must use GJS custom import scheme.
// https://gjs.guide/extensions/overview/imports-and-modules.html#imports-and-modules
// https://gjs-docs.gnome.org/gjs/esmodules.md
// > JS ERROR: Extension randomwallpaper@iflow.space: SyntaxError: import declarations may only appear at top level of a module
// For correct typing use: 'InstanceType<typeof Adw.ActionRow>'
const GLib = imports.gi.GLib;

import type * as LoggerNamespace from './logger.js';
import type * as AFTimer from './timer.js';
import type * as WallpaperControllerNamespace from './wallpaperController.js';
import type * as RandomWallpaperMenuNamespace from './randomWallpaperMenu.js';
import type {ExtensionMeta} from 'ExtensionMeta';

let Logger: typeof LoggerNamespace | null = null;
let Timer: typeof AFTimer | null = null;
let WallpaperController: typeof WallpaperControllerNamespace | null = null;
let RandomWallpaperMenu: typeof RandomWallpaperMenuNamespace | null = null;

/**
 * This function is called once when your extension is loaded, not enabled. This
 * is a good time to setup translations or anything else you only do once.
 *
 * You MUST NOT make any changes to GNOME Shell, connect any signals or add any
 * MainLoop sources here.
 *
 * @param {ExtensionMeta} unusedMeta An extension meta object, https://gjs.guide/extensions/overview/anatomy.html#extension-meta-object
 * @returns {Extension} an object with enable() and disable() methods
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
function init(unusedMeta: ExtensionMeta): Extension {
    return new Extension();
}

/**
 * Own extension class object. Entry point for Gnome Shell hooks.
 *
 * The functions enable() and disable() are required.
 */
class Extension {
    private _logger: LoggerNamespace.Logger | null = null;
    private _wallpaperController: WallpaperControllerNamespace.WallpaperController | null = null;
    private _panelMenu: RandomWallpaperMenuNamespace.RandomWallpaperMenu | null = null;
    private _timer: AFTimer.AFTimer | null = null;

    /**
     * This function is called when your extension is enabled, which could be
     * done in GNOME Extensions, when you log in or when the screen is unlocked.
     *
     * This is when you should setup any UI for your extension, change existing
     * widgets, connect signals or modify GNOME Shell's behavior.
     */
    enable(): void {
        // Workaround crash when initializing the gnome shell with this extension active while being on X11
        // https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/6691
        // TODO: Remove once that issue is fixed.
        const crashWorkaround = new Promise<void>(resolve => {
            GLib.timeout_add(GLib.PRIORITY_HIGH, 100, () => {
                resolve();
                return GLib.SOURCE_REMOVE;
            });
        });

        // Dynamically load own modules. This allows us to use proper ES6 Modules
        crashWorkaround.then(() => {
            this._importModules().then(() => {
                if (!Logger || !Timer || !WallpaperController || !RandomWallpaperMenu)
                    throw new Error('Error importing module');

                this._logger = new Logger.Logger('RWG3', 'Main');
                this._timer = Timer.AFTimer.getTimer();
                this._wallpaperController = new WallpaperController.WallpaperController();
                this._panelMenu = new RandomWallpaperMenu.RandomWallpaperMenu(this._wallpaperController);

                this._logger.info('Enable extension.');
                this._panelMenu.init();
            }).catch(error => {
                if (this._logger)
                    this._logger.error(error);
                else if (error instanceof Error)
                    logError(error);
                else
                    logError(new Error('Unknown error'));
            });
        }).catch(error => {
            if (error instanceof Error)
                logError(error);
            else
                logError(new Error('Unknown error'));
        });
    }

    /**
     * This function is called when your extension is uninstalled, disabled in
     * GNOME Extensions, when you log out or when the screen locks.
     *
     * Anything you created, modified or setup in enable() MUST be undone here.
     * Not doing so is the most common reason extensions are rejected in review!
     */
    disable(): void {
        if (this._logger)
            this._logger.info('Disable extension.');

        if (this._panelMenu)
            this._panelMenu.cleanup();

        // cleanup the timer singleton
        if (Timer)
            Timer.AFTimer.destroy();

        this._timer = null;
        this._logger = null;
        this._panelMenu = null;
        this._wallpaperController = null;

        Timer = null;
        Logger = null;
        WallpaperController = null;
        RandomWallpaperMenu = null;
    }

    /**
     * Import helper function.
     *
     * Loads all required modules async.
     * This allows to omit the legacy GJS style imports (`const asd = imports.gi.asd`)
     * and use proper modules for subsequent files.
     *
     * When the shell allows proper modules for loaded files (extension.js and prefs.js)
     * this function can be removed and replaced by normal import statements.
     */
    private async _importModules(): Promise<void> {
        const loggerPromise = import('./logger.js');
        const timerPromise = import('./timer.js');
        const wallpaperPromise = import('./wallpaperController.js');
        const menuPromise = import('./randomWallpaperMenu.js');

        const [moduleLogger, moduleTimer, moduleWallpaper, moduleMenu] = await Promise.all([
            loggerPromise, timerPromise, wallpaperPromise, menuPromise,
        ]);

        Logger = moduleLogger;
        Timer = moduleTimer;
        WallpaperController = moduleWallpaper;
        RandomWallpaperMenu = moduleMenu;
    }
}
