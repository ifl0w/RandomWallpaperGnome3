import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';

import * as ExtensionUtils from '@gi/misc/extensionUtils';

import * as HistoryModule from './history.js';
import * as SettingsModule from './settings.js';
import * as Utils from './utils.js';

import {AFTimer as Timer} from './timer.js';
import {HydraPaper} from './hydraPaper.js';
import {Logger} from './logger.js';

// SourceAdapter
import {BaseAdapter} from './adapter/baseAdapter.js';
import {GenericJsonAdapter} from './adapter/genericJson.js';
import {LocalFolderAdapter} from './adapter/localFolder.js';
import {RedditAdapter} from './adapter/reddit.js';
import {UnsplashAdapter} from './adapter/unsplash.js';
import {UrlSourceAdapter} from './adapter/urlSource.js';
import {WallhavenAdapter} from './adapter/wallhaven.js';

const Self = ExtensionUtils.getCurrentExtension();

// https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper
Gio._promisify(Gio.File.prototype, 'move_async', 'move_finish');

class WallpaperController {
    wallpaperLocation: string;

    private _backendConnection = new SettingsModule.Settings(SettingsModule.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);
    private _logger = new Logger('RWG3', 'WallpaperController');
    private _settings = new SettingsModule.Settings();
    private _timer = Timer.getTimer();
    private _prohibitTimer = false;
    private _historyController: HistoryModule.HistoryController;
    private _hydraPaper = new HydraPaper();
    private _autoFetch = {active: false, duration: 30};
    private _previewId: string | undefined;
    private _resetWallpaper = false;
    private _timeout: number | null = null;
    /** functions will be called upon loading a new wallpaper */
    private _startLoadingHooks: (() => void)[] = [];
    /** functions will be called when loading a new wallpaper stopped. If an error occurred then the error will be passed as parameter. */
    private _stopLoadingHooks: (() => void)[] = [];

    constructor() {
        let xdg_cache_home = GLib.getenv('XDG_CACHE_HOME');
        if (!xdg_cache_home)
            xdg_cache_home = `${GLib.getenv('HOME')}/.cache`;


        this.wallpaperLocation = `${xdg_cache_home}/${Self.metadata['uuid']}/wallpapers/`;
        let mode = 0o0755;
        GLib.mkdir_with_parents(this.wallpaperLocation, mode);

        this._historyController = new HistoryModule.HistoryController(this.wallpaperLocation);

        // Bring values to defined stage
        this._backendConnection.setBoolean('clear-history', false);
        this._backendConnection.setBoolean('open-folder', false);
        this._backendConnection.setBoolean('pause-timer', false);
        this._backendConnection.setBoolean('request-new-wallpaper', false);

        // Track value changes
        this._backendConnection.observe('clear-history', () => this._clearHistory());
        this._backendConnection.observe('open-folder', () => this._openFolder());
        this._backendConnection.observe('pause-timer', () => this._pauseTimer());
        this._backendConnection.observe('request-new-wallpaper', () => this._requestNewWallpaper().catch(logError));

        this._settings.observe('history-length', () => this._updateHistory());
        this._settings.observe('auto-fetch', () => this._updateAutoFetching());
        this._settings.observe('minutes', () => this._updateAutoFetching());
        this._settings.observe('hours', () => this._updateAutoFetching());

        this._updateHistory();
        this._updateAutoFetching();

        // load a new wallpaper on startup
        if (this._settings.getBoolean('fetch-on-startup'))
            this.fetchNewWallpaper().catch(logError);

        // Initialize favorites folder
        // TODO: There's probably a better place for this
        const favoritesFolderSetting = this._settings.getString('favorites-folder');
        let favoritesFolder: Gio.File;
        if (favoritesFolderSetting === '') {
            const directoryPictures = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);

            if (directoryPictures === null) {
                // Pictures not set up
                const directoryDownloads = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD);

                if (directoryDownloads === null) {
                    const xdg_data_home = GLib.get_user_data_dir();
                    favoritesFolder = Gio.File.new_for_path(xdg_data_home);
                } else {
                    favoritesFolder = Gio.File.new_for_path(directoryDownloads);
                }
            } else {
                favoritesFolder = Gio.File.new_for_path(directoryPictures);
            }

            favoritesFolder = favoritesFolder.get_child(Self.metadata['uuid']);

            const favoritesFolderPath = favoritesFolder.get_path();
            if (favoritesFolderPath)
                this._settings.setString('favorites-folder', favoritesFolderPath);
        }
    }

    private _clearHistory() {
        if (this._backendConnection.getBoolean('clear-history')) {
            this.update();
            this.deleteHistory();
            this._backendConnection.setBoolean('clear-history', false);
        }
    }

    private _openFolder() {
        if (this._backendConnection.getBoolean('open-folder')) {
            let uri = GLib.filename_to_uri(this.wallpaperLocation, '');
            Gio.AppInfo.launch_default_for_uri(uri, Gio.AppLaunchContext.new());
            this._backendConnection.setBoolean('open-folder', false);
        }
    }

    private _pauseTimer() {
        if (this._backendConnection.getBoolean('pause-timer')) {
            this._prohibitTimer = true;
            this._updateAutoFetching();
        } else {
            this._prohibitTimer = false;
            this._updateAutoFetching();
        }
    }

    private async _requestNewWallpaper() {
        if (this._backendConnection.getBoolean('request-new-wallpaper')) {
            this.update();
            try {
                await this.fetchNewWallpaper();
            } finally {
                this.update();
                this._backendConnection.setBoolean('request-new-wallpaper', false);
            }
        }
    }

    private _updateHistory() {
        this._historyController.load();
    }

    private _updateAutoFetching() {
        let duration = 0;
        duration += this._settings.getInt('minutes');
        duration += this._settings.getInt('hours') * 60;
        this._autoFetch.duration = duration;
        this._autoFetch.active = this._settings.getBoolean('auto-fetch');

        // only start timer if not in context of preferences window
        if (!this._prohibitTimer && this._autoFetch.active) {
            this._timer.registerCallback(() => {
                this.fetchNewWallpaper().catch(logError);
            });
            this._timer.setMinutes(this._autoFetch.duration);
            this._timer.start();
        } else {
            this._timer.stop();
        }
    }

    /**
     randomly returns an enabled and configured SourceAdapter
     returns a default UnsplashAdapter in case of failure
     */
    private _getRandomAdapter() {
        const sourceID = this._getRandomSource();

        let imageSourceAdapter: BaseAdapter;
        let sourceName = 'undefined';
        let sourceType = -1;

        if (sourceID !== '-1') {
            const path = `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${sourceID}/`;
            const settingsGeneral = new SettingsModule.Settings(SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);

            sourceName = settingsGeneral.getString('name');
            sourceType = settingsGeneral.getEnum('type');
        }

        try {
            switch (sourceType) {
            case 0:
                imageSourceAdapter = new UnsplashAdapter(sourceID, sourceName, this.wallpaperLocation);
                break;
            case 1:
                imageSourceAdapter = new WallhavenAdapter(sourceID, sourceName, this.wallpaperLocation);
                break;
            case 2:
                imageSourceAdapter = new RedditAdapter(sourceID, sourceName, this.wallpaperLocation);
                break;
            case 3:
                imageSourceAdapter = new GenericJsonAdapter(sourceID, sourceName, this.wallpaperLocation);
                break;
            case 4:
                imageSourceAdapter = new LocalFolderAdapter(sourceID, sourceName, this.wallpaperLocation);
                break;
            case 5:
                imageSourceAdapter = new UrlSourceAdapter(sourceID, sourceName, this.wallpaperLocation);
                break;
            default:
                imageSourceAdapter = new UnsplashAdapter(null, null, this.wallpaperLocation);
                sourceType = 0;
                break;
            }
        } catch (error) {
            this._logger.warn('Had errors, fetching with default settings.');
            imageSourceAdapter = new UnsplashAdapter(null, null, this.wallpaperLocation);
            sourceType = 0;
        }

        return {
            adapter: imageSourceAdapter,
            adapterId: sourceID,
            adapterType: sourceType,
        };
    }

    private _getRandomSource() {
        const sources: string[] = this._settings.getStrv('sources');

        if (sources === null || sources.length < 1)
            return '-1';


        const enabled_sources = sources.filter(element => {
            const path = `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${element}/`;
            const settingsGeneral = new SettingsModule.Settings(SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);
            return settingsGeneral.getBoolean('enabled');
        });

        if (enabled_sources === null || enabled_sources.length < 1)
            return '-1';


        // https://stackoverflow.com/a/5915122
        return enabled_sources[Utils.getRandomNumber(enabled_sources.length)];
    }

    /**
     * Sets the wallpaper and the lock screen when enabled to the given path.
     *
     * @param {string} path Path to the image
     */
    private async _setBackground(path: string) {
        const background_setting = new SettingsModule.Settings('org.gnome.desktop.background');
        const screensaver_setting = new SettingsModule.Settings('org.gnome.desktop.screensaver');
        const wallpaperUri = `file://${path}`;

        // <value value='0' nick='Background' />
        // <value value='1' nick='Lock Screen' />
        // <value value='2' nick='Background and Lock Screen' />
        // TODO: <value value='3' nick='Background and Lock Screen independently' />
        const changeType = this._settings.getEnum('change-type');

        if (changeType === 0 || changeType === 2) {
            try {
                if (this._settings.getBoolean('multiple-displays') && this._hydraPaper.isAvailable()) {
                    const wallpaperArray = this._fillMonitorsFromHistory(path);

                    await this._hydraPaper.run(wallpaperArray);

                    // Manually set key for darkmode because that's way faster
                    background_setting.setString('picture-uri-dark', background_setting.getString('picture-uri'));
                } else {
                    // set "picture-options" to "zoom" for single wallpapers
                    // hydrapaper changes this to "spanned"
                    background_setting.setString('picture-options', 'zoom');
                    this._setPictureUriOfSettingsObject(background_setting, wallpaperUri);
                }
            } catch (error) {
                this._logger.warn(String(error));
            }
        }

        if (changeType === 1) {
            try {
                if (this._settings.getBoolean('multiple-displays') && this._hydraPaper.isAvailable()) {
                    const wallpaperArray = this._fillMonitorsFromHistory(path);

                    // Remember keys, HydraPaper will change these
                    const tmpBackground = background_setting.getString('picture-uri-dark');
                    const tmpMode = background_setting.getString('picture-options');

                    // Force HydraPaper to target a different resulting image by using darkmode
                    await this._hydraPaper.run(wallpaperArray, true);

                    screensaver_setting.setString('picture-options', 'spanned');
                    this._setPictureUriOfSettingsObject(screensaver_setting, background_setting.getString('picture-uri-dark'));

                    // HydraPaper possibly changed these, change them back
                    background_setting.setString('picture-uri-dark', tmpBackground);
                    background_setting.setString('picture-options', tmpMode);
                } else {
                    // set "picture-options" to "zoom" for single wallpapers
                    screensaver_setting.setString('picture-options', 'zoom');
                    this._setPictureUriOfSettingsObject(screensaver_setting, wallpaperUri);
                }
            } catch (error) {
                this._logger.warn(String(error));
            }
        }

        if (changeType === 2)
            this._setPictureUriOfSettingsObject(screensaver_setting, background_setting.getString('picture-uri'));


        // Run general post command
        const commandString = this._settings.getString('general-post-command');
        const generalPostCommandArray = this._getCommandArray(commandString, path);
        if (generalPostCommandArray !== null) {
            try {
                await Utils.execCheck(generalPostCommandArray);
            } catch (error) {
                this._logger.warn(String(error));
            }
        }
    }

    private _fillMonitorsFromHistory(newWallpaperPath: string) {
        const monitorCount = Utils.getMonitorCount();
        const wallpaperArray = [newWallpaperPath];

        // Abuse history to fill missing images
        for (let index = 1; index < monitorCount; index++) {
            let historyElement;
            do
                historyElement = this._historyController.getRandom();
            while (this._historyController.history.length > monitorCount && historyElement.path && wallpaperArray.includes(historyElement.path));
            // ensure different wallpaper for all displays if possible

            if (historyElement.path)
                wallpaperArray.push(historyElement.path);
        }

        return wallpaperArray;
    }

    /**
     * Set the picture-uri property of the given settings object to the path.
     * Precondition: the settings object has to be a valid Gio settings object with the picture-uri property.
     *
     * @param {SettingsModule.Settings} settings The settings schema object containing the keys to change
     * @param {string} uri The picture URI to be set
     */
    private _setPictureUriOfSettingsObject(settings: SettingsModule.Settings, uri: string) {
        /*
         inspired from:
         https://bitbucket.org/LukasKnuth/backslide/src/7e36a49fc5e1439fa9ed21e39b09b61eca8df41a/backslide@codeisland.org/settings.js?at=master
         */
        const setProp = (property: string) => {
            if (settings.isWritable(property)) {
                // Set a new Background-Image (should show up immediately):
                settings.setString(property, uri);
            } else {
                throw new Error(`Property not writable: ${property}`);
            }
        };

        const availableKeys = settings.listKeys();

        let property = 'picture-uri';
        if (availableKeys.indexOf(property) !== -1)
            setProp(property);


        property = 'picture-uri-dark';
        if (availableKeys.indexOf(property) !== -1)
            setProp(property);
    }

    setWallpaper(historyId: string) {
        const historyElement = this._historyController.get(historyId);

        if (historyElement?.id && historyElement.path && this._historyController.promoteToActive(historyElement.id))
            this._setBackground(historyElement.path).catch(logError);
        else
            this._logger.warn(`The history id (${historyId}) could not be found.`);
            // TODO: Error handling history id not found.
    }

    async fetchNewWallpaper() {
        this._startLoadingHooks.forEach(element => element());

        try {
            if (!this._prohibitTimer)
                this._timer.reset(); // reset timer

            const returnObject = this._getRandomAdapter();

            let historyEntry: HistoryModule.HistoryEntry;
            let sourceFile: Gio.File;
            historyEntry = await returnObject.adapter.requestRandomImage();

            this._logger.info(`Requesting image: ${historyEntry.source.imageDownloadUrl}`);
            sourceFile = await returnObject.adapter.fetchFile(historyEntry);

            historyEntry.adapter.id = returnObject.adapterId;
            historyEntry.adapter.type = returnObject.adapterType;

            // Move file to unique naming
            const targetFolder = sourceFile.get_parent();
            const targetFile = targetFolder?.get_child(historyEntry.id);

            if (!targetFile)
                throw new Error('Failed getting targetFile');

            try {
                // This function is Gio._promisified
                if (!await sourceFile.move_async(targetFile, Gio.FileCopyFlags.NONE, 0, null, null))
                    throw new Error('Failed copying unique image.');
            } catch (moveError) {
                if (moveError === Gio.IOErrorEnum.EXISTS)
                    this._logger.warn('Image already exists in location.');
                else
                    throw moveError;
            }

            historyEntry.path = targetFile.get_path();

            if (!historyEntry.path)
                throw new Error('Failed getting historyEntry.path');

            await this._setBackground(historyEntry.path);

            // insert file into history
            this._historyController.insert(historyEntry);
        } finally {
            this._stopLoadingHooks.forEach(element => element());
        }
    }

    // TODO: Change to original historyElement if more variable get exposed
    private _getCommandArray(commandString: string, historyElementPath: string) {
        let string = commandString;
        if (string === '')
            return null;

        // Replace variables
        const variables = new Map();
        variables.set('%wallpaper_path%', historyElementPath);

        variables.forEach((value, key) => {
            string = string.replaceAll(key, value);
        });

        try {
            // https://gjs-docs.gnome.org/glib20/glib.shell_parse_argv
            // Parses a command line into an argument vector, in much the same way
            // the shell would, but without many of the expansions the shell would
            // perform (variable expansion, globs, operators, filename expansion,
            // etc. are not supported).
            return GLib.shell_parse_argv(string)[1];
        } catch (e) {
            this._logger.warn(String(e));
        }

        return null;
    }

    private _backgroundTimeout(delay?: number) {
        if (this._timeout)
            return;

        delay = delay || 200;

        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._timeout = null;
            const currentWallpaperPath = this._historyController.getCurrentElement().path;
            if (this._resetWallpaper && currentWallpaperPath) {
                this._setBackground(currentWallpaperPath).catch(logError);
                this._resetWallpaper = false;
            } else if (this._previewId !== undefined) {
                this._setBackground(this.wallpaperLocation + this._previewId).catch(logError);
            }
            return false;
        });
    }

    previewWallpaper(historyId: string, delay?: number) {
        if (!this._settings.getBoolean('disable-hover-preview')) {
            this._previewId = historyId;
            this._resetWallpaper = false;

            this._backgroundTimeout(delay);
        }
    }

    resetWallpaper() {
        if (!this._settings.getBoolean('disable-hover-preview')) {
            this._resetWallpaper = true;
            this._backgroundTimeout();
        }
    }

    getHistoryController() {
        return this._historyController;
    }

    deleteHistory() {
        this._historyController.clear();
    }

    update() {
        this._updateHistory();
    }

    registerStartLoadingHook(fn: () => void) {
        if (typeof fn === 'function')
            this._startLoadingHooks.push(fn);
    }

    registerStopLoadingHook(fn: () => void) {
        if (typeof fn === 'function')
            this._stopLoadingHooks.push(fn);
    }

    private _bailOutWithCallback(msg: string, callback?: () => void) {
        this._logger.error(msg);

        if (callback)
            callback();
    }
}

export {WallpaperController};
