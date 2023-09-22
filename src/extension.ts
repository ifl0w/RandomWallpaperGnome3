import * as AFTimer from './timer.js';
import * as WallpaperController from './wallpaperController.js';
import * as RandomWallpaperMenu from './randomWallpaperMenu.js';

import {Logger} from './logger.js';

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
    private _wallpaperController: WallpaperController.WallpaperController | null = null;
    private _panelMenu: RandomWallpaperMenu.RandomWallpaperMenu | null = null;
    private _timer: AFTimer.AFTimer | null = null;

    /**
     * This function is called when your extension is enabled, which could be
     * done in GNOME Extensions, when you log in or when the screen is unlocked.
     *
     * This is when you should setup any UI for your extension, change existing
     * widgets, connect signals or modify GNOME Shell's behavior.
     */
    enable(): void {
        this._timer = AFTimer.AFTimer.getTimer();
        this._wallpaperController = new WallpaperController.WallpaperController();
        this._panelMenu = new RandomWallpaperMenu.RandomWallpaperMenu(this._wallpaperController);

        Logger.info('Enable extension.', this);
        this._panelMenu.init();
    }

    /**
     * This function is called when your extension is uninstalled, disabled in
     * GNOME Extensions, when you log out or when the screen locks.
     *
     * Anything you created, modified or setup in enable() MUST be undone here.
     * Not doing so is the most common reason extensions are rejected in review!
     */
    disable(): void {
        Logger.info('Disable extension.');

        if (this._panelMenu)
            this._panelMenu.cleanup();

        // cleanup the timer singleton
        if (this._timer)
            AFTimer.AFTimer.destroy();

        if (this._wallpaperController)
            this._wallpaperController.cleanup();

        this._timer = null;
        this._panelMenu = null;
        this._wallpaperController = null;

        // Destruction of log helper is the last step
        Logger.destroy();
    }
}

export {Extension as default};
