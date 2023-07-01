import {Logger} from '../logger.js';
import type {Settings} from './../settings.js';

const enum Mode {
    BACKGROUND,
    LOCKSCREEN,
    BACKGROUND_AND_LOCKSCREEN,
    BACKGROUND_AND_LOCKSCREEN_INDEPENDENT,
}

/**
 * Wallpaper manager is a base class for manager to implement.
 */
abstract class WallpaperManager {
    protected abstract _logger: Logger;
    canHandleMultipleImages = false;

    /**
     * Set the wallpapers for a given mode.
     *
     * Modes:
     * - 0: Background
     * - 1: Lock screen
     * - 2: Background and lock screen
     *
     * @param {string[]} wallpaperPaths Array of paths to the desired wallpapers, should match the display count
     * @param {Mode} mode Enum indicating what images to change
     * @param {Settings} backgroundSettings Settings object containing the background settings
     * @param {Settings} screensaverSettings Settings object containing the screensaver/lockscreen settings
     */
    async setWallpaper(wallpaperPaths: string[], mode: Mode, backgroundSettings: Settings, screensaverSettings: Settings): Promise<void> {
        const promises = [];

        if (mode === Mode.BACKGROUND || mode === Mode.BACKGROUND_AND_LOCKSCREEN)
            promises.push(this._setBackground(wallpaperPaths, backgroundSettings));

        if (mode === Mode.LOCKSCREEN || mode === Mode.BACKGROUND_AND_LOCKSCREEN)
            promises.push(this._setLockScreen(wallpaperPaths, backgroundSettings, screensaverSettings));

        await Promise.allSettled(promises);
    }

    protected abstract _setBackground(wallpaperPaths: string[], backgroundSettings: Settings): Promise<void>;
    protected abstract _setLockScreen(wallpaperPaths: string[], backgroundSettings: Settings, screensaverSettings: Settings): Promise<void>;
}

export {
    WallpaperManager,
    Mode
};
