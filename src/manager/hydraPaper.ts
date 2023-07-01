import * as Utils from '../utils.js';

import {Logger} from '../logger.js';
import {WallpaperManager} from './wallpaperManager.js';
import {Settings} from '../settings.js';

/**
 * Wrapper for HydraPaper using it as a manager.
 */
class HydraPaper extends WallpaperManager {
    readonly _possibleCommands = ['hydrapaper', 'org.gabmus.hydrapaper'];
    _logger = new Logger('RWG3', 'HydraPaper');

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
            await this._createCommandAndRun(wallpaperPaths);

            // Manually set key for darkmode because that's way faster
            backgroundSettings.setString('picture-uri-dark', backgroundSettings.getString('picture-uri'));
        }

        if (mode === 1 && backgroundSettings && screensaverSettings) {
            // Remember keys, HydraPaper will change these
            const tmpBackground = backgroundSettings.getString('picture-uri-dark');
            const tmpMode = backgroundSettings.getString('picture-options');

            // Force HydraPaper to target a different resulting image by using darkmode
            await this._createCommandAndRun(wallpaperPaths, true);

            screensaverSettings.setString('picture-options', 'spanned');
            Utils.setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri-dark'));

            // HydraPaper possibly changed these, change them back
            backgroundSettings.setString('picture-uri-dark', tmpBackground);
            backgroundSettings.setString('picture-options', tmpMode);
        }

        if (mode === 2 && screensaverSettings && backgroundSettings)
            Utils.setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri'));
    }

    /**
     * Run HydraPaper in CLI mode.
     *
     * HydraPaper:
     * - Saves merged images in the cache folder.
     * - Sets `picture-option` to `spanned`
     * - Sets `picture-uri` or `picture-uri-dark` depending on {@link darkmode}
     * - Needs matching image path count and display count
     *
     * @param {string[]} wallpaperArray Array of image paths, should match the display count
     * @param {boolean} darkmode Use darkmode, gives different image in cache path
     */
    private async _createCommandAndRun(wallpaperArray: string[], darkmode: boolean = false): Promise<void> {
        let command = [];

        if (darkmode)
            command.push('--darkmode');

        // hydrapaper [--darkmode] --cli PATH PATH PATH
        command.push('--cli');
        command = command.concat(wallpaperArray);

        await this._runExternal(command);
    }
}

export {HydraPaper};
