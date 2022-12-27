import type {Settings} from './../settings.js';

import {HydraPaper} from './hydraPaper.js';

abstract class WallpaperManager {
    abstract isAvailable(): boolean;
    abstract cancelRunning(): void;

    /**
     * Set the wallpapers for a given mode.
     *
     * Modes:
     * 0: Background
     * 1: Lock screen
     * 2: Background and lock screen
     *
     * @param {string[]} wallpaperPaths Array of paths to the desired wallpapers, should match the display count
     * @param {number} mode Mode to operate in
     * @param {Settings} backgroundSettings Settings object of the background
     * @param {Settings} screensaverSettings Settings object of the screensaver
     */
    abstract setWallpaper(wallpaperPaths: string[], mode: number, backgroundSettings: Settings, screensaverSettings: Settings): Promise<void>;
}

/**
 *
 */
function getWallpaperManager(): WallpaperManager | null {
    const hydraPaper = new HydraPaper();

    if (hydraPaper.isAvailable())
        return hydraPaper;

    return null;
}

export {WallpaperManager, getWallpaperManager};
