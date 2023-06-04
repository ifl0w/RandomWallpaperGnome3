import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Utils from '../utils.js';

import {Logger} from './../logger.js';
import {Settings} from './../settings.js';
import {WallpaperManager} from './wallpaperManager.js';

/**
 * Wrapper for Superpaper using it as a manager.
 */
class Superpaper implements WallpaperManager {
    private _command: string[] | null = null;
    private _cancellable: Gio.Cancellable | null = null;
    private _logger = new Logger('RWG3', 'Superpaper');

    /**
     * Checks if Superpaper is available in the $PATH.
     *
     * @returns {boolean} Whether Superpaper is found
     */
    isAvailable(): boolean {
        if (this._command !== null)
            return true;

        const path = GLib.find_program_in_path('superpaper');
        if (path) {
            this._command = [path];
            return true;
        }

        return false;
    }

    /**
     * Forcefully stop a previously started Superpaper process.
     */
    cancelRunning(): void {
        if (!this._cancellable)
            return;

        this._logger.debug('Stopping running HydraPaper process.');
        this._cancellable.cancel();
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
    async setWallpaper(wallpaperPaths: string[], mode: number, backgroundSettings: Settings, screensaverSettings: Settings): Promise<void> {
        if ((mode === 0 || mode === 2) && backgroundSettings)
            await this._run(wallpaperPaths);

        if (mode === 1 && backgroundSettings && screensaverSettings) {
            // Remember keys, Superpaper will change these
            const tmpBackground = backgroundSettings.getString('picture-uri');
            const tmpBackgroundDark = backgroundSettings.getString('picture-uri-dark');
            const tmpMode = backgroundSettings.getString('picture-options');

            await this._run(wallpaperPaths);

            screensaverSettings.setString('picture-options', 'spanned');
            Utils.setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri-dark'));

            // Superpaper possibly changed these, change them back
            backgroundSettings.setString('picture-uri', tmpBackground);
            backgroundSettings.setString('picture-uri-dark', tmpBackgroundDark);
            backgroundSettings.setString('picture-options', tmpMode);
        }

        if (mode === 2 && screensaverSettings && backgroundSettings)
            Utils.setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri'));
    }

    // https://github.com/hhannine/superpaper/blob/master/docs/cli-usage.md
    /**
     * Run Superpaper in CLI mode.
     *
     * Superpaper:
     * - Saves merged images alternating in "$XDG_CACHE_HOME/superpaper/temp/cli-{a,b}.png"
     * - Sets picture-option to spanned
     * - Sets both picture-uri options, light and dark
     * - Can use only single images
     *
     * @param {string[]} wallpaperArray Array of paths to the desired wallpapers, should match the display count, can be a single image
     */
    private async _run(wallpaperArray: string[]): Promise<void> {
        // Cancel already running processes before starting new ones
        this.cancelRunning();

        if (!this._command)
            return;

        // Needs a copy here
        let command = [...this._command];

        // cspell:disable-next-line
        command.push('--setimages');
        command = command.concat(wallpaperArray);

        this._cancellable = new Gio.Cancellable();

        this._logger.debug(`Running command: ${command.toString()}`);
        await Utils.execCheck(command, this._cancellable);

        this._cancellable = null;
    }
}

export {Superpaper};
