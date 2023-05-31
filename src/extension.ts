import GLib from 'gi://GLib';

import type * as LoggerNamespace from './logger.js';
import type * as AFTimer from './timer.js';
import type * as WallpaperControllerNamespace from './wallpaperController.js';
import type * as RandomWallpaperMenuNamespace from './randomWallpaperMenu.js';

let Logger: typeof LoggerNamespace | null = null;
let Timer: typeof AFTimer | null = null;
let WallpaperController: typeof WallpaperControllerNamespace | null = null;
let RandomWallpaperMenu: typeof RandomWallpaperMenuNamespace | null = null;

/**
 *
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
function init(): Extension {
    return new Extension();
}

class Extension {
    private _logger: LoggerNamespace.Logger | null = null;
    private _wallpaperController: WallpaperControllerNamespace.WallpaperController | null = null;
    private _panelMenu: RandomWallpaperMenuNamespace.RandomWallpaperMenu | null = null;
    private _timer: AFTimer.AFTimer | null = null;

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

    private async _importModules(): Promise<void> {
        // All imports as dynamic loads to work around the fact this module won't be in a topmost
        // context inside the gnome shell and can't use import statements (yet).
        // PopOS' tiling extension and RoundedCorners Extension work around the above limitation by
        // manually rewriting the exported javascript file. We also have to do this but
        // not for our own modules.
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
