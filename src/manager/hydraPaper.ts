import Gio from 'gi://Gio';

import * as Utils from '../utils.js';
import {Settings} from './../settings.js';

import {ExternalWallpaperManager} from './externalWallpaperManager.js';

// https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper
Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');

/**
 * Wrapper for HydraPaper using it as a manager.
 */
class HydraPaper extends ExternalWallpaperManager {
    protected readonly _possibleCommands = ['hydrapaper', 'org.gabmus.hydrapaper'];

    /**
     * We have to know if HydraPaper is in a version >= 3.3.2
     * With that version the behavior changed to automatic light/dark mode detection.
     */
    private static _versionIsOld?: boolean;

    /**
     * Sets the background image in light and dark mode.
     *
     * @param {string[]} wallpaperPaths Array of strings to image files
     */
    protected async _setBackground(wallpaperPaths: string[]): Promise<void> {
        await this._createCommandAndRun(wallpaperPaths);
        await this._syncColorModes(this._backgroundSettings, this._backgroundSettings);
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
        await this._syncColorModes(this._screensaverSettings, this._backgroundSettings);

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
     * Since version 3.3.2 HydraPaper sets the mode automatically depending on the currently used dark/light mode.
     * HydraPaper might be in a version below 3.3.2 which only sets light mode.
     *
     * @param {Settings} sourceSettings Settings object containing the picture-uri to sync from
     * @param {Settings} targetSettings Settings object containing the picture-uri to sync to
     */
    private async _syncColorModes(sourceSettings: Settings, targetSettings: Settings): Promise<void> {
        if (HydraPaper._versionIsOld === undefined || HydraPaper._versionIsOld === null)
            await this._getVersion();

        // The old version only sets light mode and we can simply sync to dark mode
        if (HydraPaper._versionIsOld) {
            Utils.setPictureUriOfSettingsObject(targetSettings, sourceSettings.getString('picture-uri'));
            return;
        }

        /**
         * The new version sets the correct mode automatically.
         * We have to guess which one it is and sync to the other.
         */
        const interfaceSettings = new Settings('org.gnome.desktop.interface');

        // 'default', 'prefer-dark', 'prefer-light'
        const theme = interfaceSettings.getString('color-scheme');

        if (theme === 'default' || theme === 'prefer-light')
            Utils.setPictureUriOfSettingsObject(targetSettings, sourceSettings.getString('picture-uri'));

        if (theme === 'prefer-dark')
            Utils.setPictureUriOfSettingsObject(targetSettings, sourceSettings.getString('picture-uri-dark'));
    }

    /**
     * Workaround for detecting old HydraPaper versions by testing supported command-line options.
     * This has to be done because there is no dedicated way to list the version (i.e., there is no --version option).
     *
     * This tests if the argument '--dark' is known:
     * Versions < 3.3.2 know that argument
     * Versions >= 3.3.2 don't know that argument
     */
    // https://gjs.guide/guides/gio/subprocesses.html#communicating-with-processes
    private async _getVersion(): Promise<void> {
        if (!ExternalWallpaperManager._command || ExternalWallpaperManager._command.length < 1)
            throw new Error('Command empty!');

        /**
         * We care for the success/failure of '--dark'.
         * '--cli' is evaluated before, so we have to give a fake wallpaper path to pass that check.
         */
        const command = ExternalWallpaperManager._command.concat(['--dark', '--cli', 'dummyWallpaperPath']);
        const proc = Gio.Subprocess.new(command, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

        const [_, stderr] = await proc.communicate_utf8_async(null, null);

        // We expect this to fail
        if (proc.get_successful())
            throw new Error('HydraPaper did not fail.');

        // Assuming new version with this specific error.
        if (stderr && stderr.includes('error: unrecognized arguments: --dark')) {
            HydraPaper._versionIsOld = false;
            return;
        }

        // Otherwise assume it's the old version
        HydraPaper._versionIsOld = true;
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
