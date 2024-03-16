import * as Utils from '../utils.js';

import {WallpaperManager, getZoomModeEnum} from './wallpaperManager.js';
import {Logger} from '../logger.js';
import {Settings} from '../settings.js';

/**
 * A general default wallpaper manager.
 *
 * Unable to handle multiple displays.
 */
class DefaultWallpaperManager extends WallpaperManager {
    /**
     * Sets the background image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files, expects a single image only.
     * @returns {Promise<void>} Only resolves
     */
    protected async _setBackground(wallpaperPaths: string[]): Promise<void> {
        // The default manager can't handle multiple displays
        if (wallpaperPaths.length > 1)
            Logger.warn('Single handling manager called with multiple images!', this);

        await DefaultWallpaperManager.setSingleBackground(`file://${wallpaperPaths[0]}`, this._backgroundSettings);

        return Promise.resolve();
    }

    /**
     * Sets the lock screen image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files, expects a single image only.
     * @returns {Promise<void>} Only resolves
     */
    protected async _setLockScreen(wallpaperPaths: string[]): Promise<void> {
        // The default manager can't handle multiple displays
        if (wallpaperPaths.length > 1)
            Logger.warn('Single handling manager called with multiple images!', this);

        await DefaultWallpaperManager.setSingleLockScreen(`file://${wallpaperPaths[0]}`, this._backgroundSettings, this._screensaverSettings);

        return Promise.resolve();
    }

    /**
     * Default fallback function to set a single image background.
     *
     * @param {string} wallpaperURI URI to image file
     * @param {Settings} backgroundSettings Settings containing the background `picture-uri` key
     * @returns {Promise<void>} Only resolves
     */
    static setSingleBackground(wallpaperURI: string, backgroundSettings: Settings): Promise<void> {
        if (Utils.isImageMerged(wallpaperURI))
            // merged wallpapers need mode "spanned"
            backgroundSettings.setString('picture-options', 'spanned');
        else
            backgroundSettings.setString('picture-options', getZoomModeEnum()[new Settings().getInt('zoom-mode')]);

        Utils.setPictureUriOfSettingsObject(backgroundSettings, wallpaperURI);
        return Promise.resolve();
    }

    /**
     *Default fallback function to set a single image lock screen.
     *
     * @param {string} wallpaperURI URI to image file
     * @param {Settings} backgroundSettings Settings containing the background `picture-uri` key
     * @param {Settings} screensaverSettings Settings containing the lock screen `picture-uri` key
     * @returns {Promise<void>} Only resolves
     */
    static setSingleLockScreen(wallpaperURI: string, backgroundSettings: Settings, screensaverSettings: Settings): Promise<void> {
        if (Utils.isImageMerged(wallpaperURI))
            // merged wallpapers need mode "spanned"
            screensaverSettings.setString('picture-options', 'spanned');
        else
            screensaverSettings.setString('picture-options', getZoomModeEnum()[new Settings().getInt('zoom-mode')]);

        Utils.setPictureUriOfSettingsObject(screensaverSettings, wallpaperURI);
        return Promise.resolve();
    }

    /**
     * Check if a filename matches a merged wallpaper name.
     *
     * Merged wallpaper need special handling as these are single images
     * but span across all displays.
     *
     * @param {string} _filename Unused naming to check
     * @returns {boolean} Whether the image is a merged wallpaper
     */
    static isImageMerged(_filename: string): boolean {
        // This manager can't create merged wallpaper
        return false;
    }
}


export {DefaultWallpaperManager};
