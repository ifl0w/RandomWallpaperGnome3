import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Logger} from 'logger.js';
import type {Settings} from './../settings.js';
import * as Utils from '../utils.js';

import {HydraPaper} from './hydraPaper.js';
import {Superpaper} from './superPaper.js';

/**
 * Wallpaper manager is a base class for external manager to implement.
 *
 * Currently this is only used when in multiple monitor mode.
 */
abstract class WallpaperManager {
    private _cancellable: Gio.Cancellable | null = null;
    protected static _command: string[] | null = null;
    protected abstract readonly _possibleCommands: string[];
    protected abstract _logger: Logger;

    /**
     * Forcefully stop a previously started manager process.
     */
    private _cancelRunning(): void {
        if (this._cancellable === null)
            return;

        this._logger.debug('Stopping manager process.');
        this._cancellable.cancel();
        this._cancellable = null;
    }

    /**
     * Checks if the current manager is available in the `$PATH`.
     *
     * @returns {boolean} Whether the manager is found
     */
    isAvailable(): boolean {
        if (WallpaperManager._command !== null)
            return true;

        for (const command of this._possibleCommands) {
            const path = GLib.find_program_in_path(command);

            if (path) {
                WallpaperManager._command = [path];
                break;
            }
        }

        return WallpaperManager._command !== null;
    }

    /**
     * Wrapper around calling the program command together with arguments.
     *
     * @param {string[]} commandArguments Arguments to append
     */
    protected async _runExternal(commandArguments: string[]): Promise<void> {
        // Cancel already running processes before starting new ones
        this._cancelRunning();

        if (!WallpaperManager._command || WallpaperManager._command.length < 1)
            throw new Error('Command empty!');

        // Needs a copy here
        const command = WallpaperManager._command.concat(commandArguments);

        this._cancellable = new Gio.Cancellable();

        this._logger.debug(`Running command: ${command.toString()}`);
        await Utils.execCheck(command, this._cancellable);

        this._cancellable = null;
    }

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
