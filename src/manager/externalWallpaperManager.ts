import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Utils from '../utils.js';

import {DefaultWallpaperManager} from './defaultWallpaperManager.js';
import {Mode, WallpaperManager} from './wallpaperManager.js';
import type {Settings} from '../settings.js';

/**
 * Abstract base class for external manager to implement.
 */
abstract class ExternalWallpaperManager extends WallpaperManager {
    private _cancellable: Gio.Cancellable | null = null;
    protected static _command: string[] | null = null;
    protected abstract readonly _possibleCommands: string[];
    canHandleMultipleImages = true;

    /**
     * Checks if the current manager is available in the `$PATH`.
     *
     * @returns {boolean} Whether the manager is found
     */
    isAvailable(): boolean {
        if (ExternalWallpaperManager._command !== null)
            return true;

        for (const command of this._possibleCommands) {
            const path = GLib.find_program_in_path(command);

            if (path) {
                ExternalWallpaperManager._command = [path];
                break;
            }
        }

        return ExternalWallpaperManager._command !== null;
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
     * @param {Mode} mode Enum indicating what images to change
     * @param {Settings} backgroundSettings Settings object containing the background settings
     * @param {Settings} screensaverSettings Settings object containing the screensaver/lockscreen settings
     */
    async setWallpaper(wallpaperPaths: string[], mode: Mode, backgroundSettings: Settings, screensaverSettings: Settings): Promise<void> {
        // Cancel already running processes before setting new images
        this._cancelRunning();

        // Fallback to default manager, all currently supported external manager don't support setting single images
        if (wallpaperPaths.length === 1) {
            const promises = [];

            if (mode === Mode.BACKGROUND || mode === Mode.BACKGROUND_AND_LOCKSCREEN)
                promises.push(DefaultWallpaperManager.setSingleBackground(`file://${wallpaperPaths[0]}`, backgroundSettings));

            if (mode === Mode.LOCKSCREEN || mode === Mode.BACKGROUND_AND_LOCKSCREEN)
                promises.push(DefaultWallpaperManager.setSingleLockScreen(`file://${wallpaperPaths[0]}`, backgroundSettings, screensaverSettings));

            await Promise.allSettled(promises);
            return;
        }

        /**
         * Don't run these concurrently!
         * External manager may need to shove settings around to circumvent the fact the manager writes multiple settings on its own.
         * These are called in this fixed order so external manager can rely on functions ran previously.
         */

        if (mode === Mode.BACKGROUND || mode === Mode.BACKGROUND_AND_LOCKSCREEN)
            await this._setBackground(wallpaperPaths, backgroundSettings);

        if (mode === Mode.LOCKSCREEN)
            await this._setLockScreen(wallpaperPaths, backgroundSettings, screensaverSettings);

        if (mode === Mode.BACKGROUND_AND_LOCKSCREEN)
            await this._setLockScreenAfterBackground(wallpaperPaths, backgroundSettings, screensaverSettings);
    }

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
     * Wrapper around calling the program command together with arguments.
     *
     * @param {string[]} commandArguments Arguments to append
     */
    protected async _runExternal(commandArguments: string[]): Promise<void> {
        // Cancel already running processes before starting new ones
        this._cancelRunning();

        if (!ExternalWallpaperManager._command || ExternalWallpaperManager._command.length < 1)
            throw new Error('Command empty!');

        // Needs a copy here
        const command = ExternalWallpaperManager._command.concat(commandArguments);

        this._cancellable = new Gio.Cancellable();

        this._logger.debug(`Running command: ${command.toString()}`);
        await Utils.execCheck(command, this._cancellable);

        this._cancellable = null;
    }

    /**
     * Sync the lock screen to the background.
     *
     * This function exists to save compute time on identical background and lock screen images.
     *
     * @param {string[]} _wallpaperPaths Unused array of strings to image files
     * @param {Settings} backgroundSettings Settings object holding the desktop background picture-uri
     * @param {Settings} screensaverSettings Settings object holding the screensaver picture-uri
     * @returns {Promise<void>} Only resolves
     */
    protected _setLockScreenAfterBackground(_wallpaperPaths: string[], backgroundSettings: Settings, screensaverSettings: Settings): Promise<void> {
        Utils.setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri'));
        return Promise.resolve();
    }
}

export {ExternalWallpaperManager};
