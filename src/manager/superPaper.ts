import * as Utils from '../utils.js';

import {ExternalWallpaperManager} from './externalWallpaperManager.js';
import {Logger} from './../logger.js';
import {Settings} from './../settings.js';

/**
 * Wrapper for Superpaper using it as a manager.
 */
class Superpaper extends ExternalWallpaperManager {
    protected readonly _possibleCommands = ['superpaper'];
    protected _logger = new Logger('RWG3', 'Superpaper');

    /**
     * Sets the background image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files
     * @param {Settings} _backgroundSettings Unused settings object
     */
    // We don't need the settings object because Superpaper already set both picture-uri on it's own.
    protected async _setBackground(wallpaperPaths: string[], _backgroundSettings: Settings): Promise<void> {
        await this._createCommandAndRun(wallpaperPaths);
    }

    /**
     * Sets the lock screen image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files
     * @param {Settings} backgroundSettings Settings object holding the desktop background picture-uri
     * @param {Settings} screensaverSettings Settings object holding the screensaver picture-uri
     */
    protected async _setLockScreen(wallpaperPaths: string[], backgroundSettings: Settings, screensaverSettings: Settings): Promise<void> {
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

    /**
     * Check if a filename matches a merged wallpaper name.
     *
     * Merged wallpaper need special handling as these are single images
     * but span across all displays.
     *
     * @param {string} filename Naming to check
     * @returns {boolean} Wether the image is a merged wallpaper
     */
    static isImageMerged(filename: string): boolean {
        const mergedWallpaperNames = [
            'cli-a',
            'cli-b',
        ];

        for (const name of mergedWallpaperNames) {
            if (filename.includes(name))
                return true;
        }

        return false;
    }
}

export {Superpaper};
