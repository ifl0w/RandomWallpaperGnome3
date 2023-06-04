import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Utils from '../utils.js';

import {Logger} from '../logger.js';
import {WallpaperManager} from './wallpaperManager.js';
import {Settings} from '../settings.js';

/**
 * Wrapper for HydraPaper using it as a manager.
 */
class HydraPaper implements WallpaperManager {
    private _command: string[] | null = null;
    private _cancellable: Gio.Cancellable | null = null;
    private _logger = new Logger('RWG3', 'HydraPaper');

    /**
     * Checks if Superpaper is available in the $PATH.
     *
     * @returns {boolean} Whether Superpaper is found
     */
    isAvailable(): boolean {
        if (this._command !== null)
            return true;

        const normalPath = GLib.find_program_in_path('hydrapaper');
        if (normalPath) {
            this._command = [normalPath];
            return true;
        }

        const flatpakPath = GLib.find_program_in_path('org.gabmus.hydrapaper');
        if (flatpakPath) {
            this._command = [flatpakPath];
            return true;
        }

        return this._command !== null;
    }

    /**
     * Forcefully stop a previously started HydraPaper process.
     */
    cancelRunning(): void {
        if (this._cancellable === null)
            return;

        this._logger.debug('Stopping running HydraPaper process.');
        this._cancellable.cancel();
        this._cancellable = null;
    }

    /**
     * Run HydraPaper in CLI mode.
     *
     * HydraPaper:
     * - Saves merged images in the cache folder.
     * - Sets picture-option to spanned
     * - Sets picture-uri or picture-uri-dark depending on $darkmode
     * - Needs matching image path count and display count
     *
     * @param {string[]} wallpaperArray Array of image paths, should match the display count
     * @param {boolean} darkmode Use darkmode, gives different image in cache path
     */
    private async _run(wallpaperArray: string[], darkmode: boolean = false): Promise<void> {
        // Cancel already running processes before starting new ones
        this.cancelRunning();

        // TODO: Proper error handling
        if (this._command === null)
            return;

        // Needs a copy here
        let command = [...this._command];

        if (darkmode)
            command.push('--darkmode');

        command.push('--cli');
        command = command.concat(wallpaperArray);

        this._cancellable = new Gio.Cancellable();

        // hydrapaper [--darkmode] --cli PATH PATH PATH
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
    async setWallpaper(wallpaperPaths: string[], mode: number, backgroundSettings?: Settings, screensaverSettings?: Settings): Promise<void> {
        if ((mode === 0 || mode === 2) && backgroundSettings) {
            await this._run(wallpaperPaths);

            // Manually set key for darkmode because that's way faster
            backgroundSettings.setString('picture-uri-dark', backgroundSettings.getString('picture-uri'));
        }

        if (mode === 1 && backgroundSettings && screensaverSettings) {
            // Remember keys, HydraPaper will change these
            const tmpBackground = backgroundSettings.getString('picture-uri-dark');
            const tmpMode = backgroundSettings.getString('picture-options');

            // Force HydraPaper to target a different resulting image by using darkmode
            await this._run(wallpaperPaths, true);

            screensaverSettings.setString('picture-options', 'spanned');
            Utils.setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri-dark'));

            // HydraPaper possibly changed these, change them back
            backgroundSettings.setString('picture-uri-dark', tmpBackground);
            backgroundSettings.setString('picture-options', tmpMode);
        }

        if (mode === 2 && screensaverSettings && backgroundSettings)
            Utils.setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri'));
    }
}

export {HydraPaper};
