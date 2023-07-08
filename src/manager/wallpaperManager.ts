import {Logger} from '../logger.js';
import type {Settings} from './../settings.js';

// Generated code produces a no-shadow rule error
/* eslint-disable */
enum Mode {
    /** Only change the desktop background */
    BACKGROUND,
    /** Only change the lock screen background */
    LOCKSCREEN,
    /** Change the desktop and lock screen background to the same image. */
    // This allows for optimizations when processing images.
    BACKGROUND_AND_LOCKSCREEN,
    /** Change each - the desktop and lock screen background - to different images. */
    BACKGROUND_AND_LOCKSCREEN_INDEPENDENT,
}
/* eslint-enable */

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

/**
 * Retrieve the human readable enum name.
 *
 * @param {Mode} mode The mode to name
 * @returns {string} Name
 */
function _getModeName(mode: Mode): string {
    let name: string;

    switch (mode) {
    case Mode.BACKGROUND:
        name = 'Background';
        break;
    case Mode.LOCKSCREEN:
        name = 'Lockscreen';
        break;
    case Mode.BACKGROUND_AND_LOCKSCREEN:
        name = 'Background and lockscreen';
        break;
    case Mode.BACKGROUND_AND_LOCKSCREEN_INDEPENDENT:
        name = 'Background and lockscreen independently';
        break;

    default:
        name = 'Mode name not found';
        break;
    }

    return name;
}

/**
 * Get a list of human readable enum entries.
 *
 * @returns {string[]} Array with key names
 */
function getModeNameList(): string[] {
    const list: string[] = [];

    const values = Object.values(Mode).filter(v => !isNaN(Number(v)));
    for (const i of values)
        list.push(_getModeName(i as Mode));

    return list;
}

export {
    WallpaperManager,
    Mode,
    getModeNameList
};
