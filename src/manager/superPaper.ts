import * as Utils from '../utils.js';

import {Logger} from './../logger.js';
import {Settings} from './../settings.js';
import {WallpaperManager} from './wallpaperManager.js';

/**
 * Wrapper for Superpaper using it as a manager.
 */
class Superpaper extends WallpaperManager {
    readonly _possibleCommands = ['superpaper'];
    _logger = new Logger('RWG3', 'Superpaper');

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
            await this._createCommandAndRun(wallpaperPaths);

        if (mode === 1 && backgroundSettings && screensaverSettings) {
            // Remember keys, Superpaper will change these
            const tmpBackground = backgroundSettings.getString('picture-uri');
            const tmpBackgroundDark = backgroundSettings.getString('picture-uri-dark');
            const tmpMode = backgroundSettings.getString('picture-options');

            await this._createCommandAndRun(wallpaperPaths);

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
     * - Saves merged images alternating in `$XDG_CACHE_HOME/superpaper/temp/cli-{a,b}.png`
     * - Sets `picture-option` to `spanned`
     * - Always sets both `picture-uri` and `picture-uri-dark` options
     * - Can use only single images
     *
     * @param {string[]} wallpaperArray Array of paths to the desired wallpapers, should match the display count, can be a single image
     */
    private async _createCommandAndRun(wallpaperArray: string[]): Promise<void> {
        let command = [];

        // cspell:disable-next-line
        command.push('--setimages');
        command = command.concat(wallpaperArray);

        await this._runExternal(command);
    }
}

export {Superpaper};
