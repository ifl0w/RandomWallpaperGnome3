import * as Utils from '../utils.js';

import {ExternalWallpaperManager} from './externalWallpaperManager.js';
import {Logger} from '../logger.js';
import {Settings} from '../settings.js';

/**
 * Wrapper for HydraPaper using it as a manager.
 */
class HydraPaper extends ExternalWallpaperManager {
    protected readonly _possibleCommands = ['hydrapaper', 'org.gabmus.hydrapaper'];
    protected _logger = new Logger('RWG3', 'HydraPaper');

    /**
     * Sets the background image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files
     * @param {Settings} backgroundSettings Settings object holding the desktop background picture-uri
     */
    protected async _setBackground(wallpaperPaths: string[], backgroundSettings: Settings): Promise<void> {
        await this._createCommandAndRun(wallpaperPaths);

        // Manually set key for darkmode because that's way faster than merging two times the same images
        Utils.setPictureUriOfSettingsObject(backgroundSettings, backgroundSettings.getString('picture-uri'));
    }

    /**
     * Sets the lock screen image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files
     * @param {Settings} backgroundSettings Settings object holding the desktop background picture-uri
     * @param {Settings} screensaverSettings Settings object holding the screensaver picture-uri
     */
    protected async _setLockScreen(wallpaperPaths: string[], backgroundSettings: Settings, screensaverSettings: Settings): Promise<void> {
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
            'merged_wallpaper',
        ];

        for (const name of mergedWallpaperNames) {
            if (filename.includes(name))
                return true;
        }

        return false;
    }
}

export {HydraPaper};
