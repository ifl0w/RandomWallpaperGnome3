import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';

import * as Utils from '../utils.js';

import {Logger} from './../logger.js';
import {Settings} from './../settings.js';
import {WallpaperManager} from './wallpaperManager.js';

class Superpaper implements WallpaperManager {
    private _command: string[] | null = null;
    private _cancellable: Gio.Cancellable | null = null;
    private _logger = new Logger('RWG3', 'Superpaper');

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

    cancelRunning(): void {
        if (!this._cancellable)
            return;

        this._logger.debug('Stopping running HydraPaper process.');
        this._cancellable.cancel();
        this._cancellable = null;
    }

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
    // * Saves merged images alternating in "$XDG_CACHE_HOME/superpaper/temp/cli-{a,b}.png"
    // * Sets picture-option to spanned
    // * Sets both picture-uri options
    // * Can use only single images
    private async _run(wallpaperArray: string[]) {
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

        this._logger.debug(`Running command: "${command}"`);
        await Utils.execCheck(command, this._cancellable);

        this._cancellable = null;
    }
}

export {Superpaper};
