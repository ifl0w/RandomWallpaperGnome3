import * as Utils from '../utils.js';

import {ExternalWallpaperManager} from './externalWallpaperManager.js';

/**
 * Wrapper for HydraPaper using it as a manager.
 */
class HydraPaper extends ExternalWallpaperManager {
    protected readonly _possibleCommands = ['hydrapaper', 'org.gabmus.hydrapaper'];

    /**
     * Sets the background image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files
     */
    protected async _setBackground(wallpaperPaths: string[]): Promise<void> {
        await this._createCommandAndRun(wallpaperPaths);

        // Manually set key for darkmode because HydraPaper might be in a version below 3.3.2 which only sets light mode
        Utils.setPictureUriOfSettingsObject(this._backgroundSettings, this._backgroundSettings.getString('picture-uri'));
    }

    /**
     * Sets the lock screen image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files
     */
    protected async _setLockScreen(wallpaperPaths: string[]): Promise<void> {
        // Remember keys, HydraPaper will change these
        const tmpBackground = this._backgroundSettings.getString('picture-uri');
        const tmpBackgroundDark = this._backgroundSettings.getString('picture-uri-dark');
        const tmpMode = this._backgroundSettings.getString('picture-options');

        await this._createCommandAndRun(wallpaperPaths);

        this._screensaverSettings.setString('picture-options', 'spanned');
        Utils.setPictureUriOfSettingsObject(this._screensaverSettings, this._backgroundSettings.getString('picture-uri-dark'));

        // HydraPaper possibly changed these, change them back
        this._backgroundSettings.setString('picture-uri', tmpBackground);
        this._backgroundSettings.setString('picture-uri-dark', tmpBackgroundDark);
        this._backgroundSettings.setString('picture-options', tmpMode);
    }

    /**
     * Run HydraPaper in CLI mode.
     *
     * HydraPaper:
     * - Saves merged images in the cache folder.
     * - Sets `picture-option` to `spanned`
     * - Sets `picture-uri` and `picture-uri-dark`, versions before 3.3.2 only set 'picture-uri'
     * - Needs matching image path count and display count
     *
     * @param {string[]} wallpaperArray Array of image paths, should match the display count
     */
    private async _createCommandAndRun(wallpaperArray: string[]): Promise<void> {
        let command = [];

        // hydrapaper --cli PATH PATH PATH
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
     * @returns {boolean} Whether the image is a merged wallpaper
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
