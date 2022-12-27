import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';

import * as Utils from '../utils.js';

import {Logger} from '../logger.js';
import {WallpaperManager} from './wallpaperManager.js';
import {Settings} from '../settings.js';

class HydraPaper implements WallpaperManager {
    private _command: string[] | null = null;
    private _cancellable: Gio.Cancellable | null = null;
    private _logger = new Logger('RWG3', 'HydraPaper');

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

    cancelRunning() {
        if (this._cancellable === null)
            return;

        this._logger.debug('Stopping running HydraPaper process.');
        this._cancellable.cancel();
        this._cancellable = null;
    }

    /**
     * Run HydraPaper in CLI mode.
     *
     * HydraPaper will combine all images in wallpaperArray into a single image and save
     * it into the users cache folder.
     * Afterward HydraPaper will set the mode to 'spanned' and the 'picture-uri' or 'picture-uri-dark'.
     *
     * @param {string[]} wallpaperArray Array of image paths
     * @param {boolean} darkmode Use darkmode, gives different image in cache path
     */
    private async _run(wallpaperArray: string[], darkmode: boolean = false) {
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
        this._logger.debug(`Running command: ${command}`);
        await Utils.execCheck(command, this._cancellable);

        this._cancellable = null;
    }

    async setWallpaper(wallpaperPaths: string[], mode: number, backgroundSettings?: Settings, screensaverSettings?: Settings) {
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
