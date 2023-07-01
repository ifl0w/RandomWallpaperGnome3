import type {Settings} from './../settings.js';

import {HydraPaper} from './hydraPaper.js';
import {Superpaper} from './superPaper.js';

/**
 * Wallpaper manager is a base class for external manager to implement.
 *
 * Currently this is only used when in multiple monitor mode.
 */
abstract class WallpaperManager {
    abstract isAvailable(): boolean;
    abstract cancelRunning(): void;

    /**
     * Set the wallpapers for a given mode.
     *
     * Modes:
     * - 0: Background
     * - 1: Lock screen
     * - 2: Background and lock screen
     *
     * @param {string[]} wallpaperPaths Array of paths to the desired wallpapers, should match the display count
     * @param {number} mode Enum indicating what images to change
     * @param {Settings} backgroundSettings Settings object containing the background settings
     * @param {Settings} screensaverSettings Settings object containing the screensaver/lockscreen settings
     */
    abstract setWallpaper(wallpaperPaths: string[], mode: number, backgroundSettings: Settings, screensaverSettings: Settings): Promise<void>;
}

/**
 * Get a wallpaper manager.
 *
 * Checks for HydraPaper first and then for Superpaper.
 *
 * @returns {WallpaperManager | null} Wallpaper manager if found or null
 */
function getWallpaperManager(): WallpaperManager | null {
    const hydraPaper = new HydraPaper();
    if (hydraPaper.isAvailable())
        return hydraPaper;

    const superpaper = new Superpaper();
    if (superpaper.isAvailable())
        return superpaper;

    return null;
}

/**
 * Check if a filename matches a merged wallpaper name.
 *
 * @param {string} filename Naming to check
 * @returns {boolean} Wether the image is a merged wallpaper
 */
// Check these outside of the class in case the user switched the manager
function isImageMerged(filename: string): boolean {
    const mergedWallpaperNames = [
        // HydraPaper
        'merged_wallpaper',
        // Superpaper
        'cli-a',
        'cli-b',
    ];

    for (const name of mergedWallpaperNames) {
        if (filename.includes(name))
            return true;
    }

    return false;
}

export {
    WallpaperManager,
    getWallpaperManager,
    isImageMerged
};
