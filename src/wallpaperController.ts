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

interface RandomAdapterResult {
            adapter: BaseAdapter,
            id: string,
            type: number,
            imageCount: number
        }

class WallpaperController {
    wallpaperLocation: string;
    prohibitNewWallpaper = false;

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

        // Bring values to defined state
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

            // Switching the switch in the menu closes the menu which triggers a hover event
            // Prohibit that from emitting because a paused timer could have surpassed the interval
            // and try to fetch new wallpaper which would be interrupted by a wallpaper reset caused
            // the the closing menu event.
            this.prohibitNewWallpaper = true;
            this._updateAutoFetching();

            // And activate emitting again after a second
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this.prohibitNewWallpaper = false;
                return GLib.SOURCE_REMOVE;
            });
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
        } else if (this._prohibitTimer && this._autoFetch.active) {
            this._timer.cleanup();
        } else {
            this._timer.stop();
        }
    }

    /**
     randomly returns an enabled and configured SourceAdapter
     returns a default UnsplashAdapter in case of failure
     *
     * @param {number} count The amount of adapter requested
     */
    private _getRandomAdapter(count: number) {
        const sourceIDs = this._getRandomSource(count);
        const randomAdapterResult: RandomAdapterResult[] = [];

        if (sourceIDs.length < 1 || sourceIDs[0] === '-1') {
            randomAdapterResult.push({
                adapter: new UnsplashAdapter(null, null, this.wallpaperLocation),
                id: '-1',
                type: 0,
                imageCount: count,
            });
            return randomAdapterResult;
        }

        /**
         *
         * @param {RandomAdapterResult[]} array Array of already chosen adapter
         * @param {number} type Type of the source
         */
        function _arrayIncludes(array: RandomAdapterResult[], type: number) {
            for (const element of array) {
                if (element.type === type)
                    return element;
            }
            return null;
        }

        for (let index = 0; index < sourceIDs.length; index++) {
            const sourceID = sourceIDs[index];
            const path = `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${sourceID}/`;
            const settingsGeneral = new SettingsModule.Settings(SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);

            let imageSourceAdapter: BaseAdapter;
            let sourceName = 'undefined';
            let sourceType = -1;

            sourceName = settingsGeneral.getString('name');
            sourceType = settingsGeneral.getEnum('type');

            const availableAdapter = _arrayIncludes(randomAdapterResult, sourceType);
            if (availableAdapter) {
                availableAdapter.imageCount++;
                continue;
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

            randomAdapterResult.push({
                adapter: imageSourceAdapter,
                id: sourceID,
                type: sourceType,
                imageCount: 1,
            });
        }

        return randomAdapterResult;
    }

    /**
     *
     * @param {number} count Amount of requested source IDs
     * @returns Array of source IDs or ['-1'] in case of failure
     */
    private _getRandomSource(count: number) {
        const sourceResult: string[] = [];
        const sources: string[] = this._settings.getStrv('sources');

        if (sources === null || sources.length < 1)
            return ['-1'];

        const enabledSources = sources.filter(element => {
            const path = `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${element}/`;
            const settingsGeneral = new SettingsModule.Settings(SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);
            return settingsGeneral.getBoolean('enabled');
        });

        if (enabledSources === null || enabledSources.length < 1)
            return ['-1'];

        for (let index = 0; index < count; index++) {
            const chosenSource = enabledSources[Utils.getRandomNumber(enabledSources.length)];
            sourceResult.push(chosenSource);
        }

        return sourceResult;
    }

    /**
     * Sets the wallpaper and the lock screen when enabled to the given path.
     *
     * @param {string[]} wallpaperArray Array of paths to the image
     * @param {number} monitorCount Number of monitors to fill
     */
    private async _setBackground(wallpaperArray: string[], monitorCount: number) {
        const multiMonitor = monitorCount > 1 && this._hydraPaper.isAvailable();
        const backgroundSettings = new SettingsModule.Settings('org.gnome.desktop.background');
        const screensaverSettings = new SettingsModule.Settings('org.gnome.desktop.screensaver');

        if (wallpaperArray.length < 1)
            throw new Error('Empty wallpaper array');

        const wallpaperUri = `file://${wallpaperArray[0]}`;
        let usedWallpaperPaths: string[] = [];

        // <value value='0' nick='Background' />
        // <value value='1' nick='Lock Screen' />
        // <value value='2' nick='Background and Lock Screen' />
        // TODO: <value value='3' nick='Background and Lock Screen independently' />
        const changeType = this._settings.getEnum('change-type');

        if (changeType === 0 || changeType === 2) {
            if (multiMonitor) {
                const newWallpaperPaths = this._fillMonitorsFromHistory(wallpaperArray, monitorCount);

                await this._hydraPaper.run(newWallpaperPaths);

                usedWallpaperPaths = newWallpaperPaths;

                // Manually set key for darkmode because that's way faster
                backgroundSettings.setString('picture-uri-dark', backgroundSettings.getString('picture-uri'));
            } else {
                // set "picture-options" to "zoom" for single wallpapers
                // hydrapaper changes this to "spanned"
                backgroundSettings.setString('picture-options', 'zoom');
                this._setPictureUriOfSettingsObject(backgroundSettings, wallpaperUri);
                usedWallpaperPaths.push(wallpaperUri);
            }
        }

        if (changeType === 1) {
            if (multiMonitor) {
                const newWallpaperPaths = this._fillMonitorsFromHistory(wallpaperArray, monitorCount);

                // Remember keys, HydraPaper will change these
                const tmpBackground = backgroundSettings.getString('picture-uri-dark');
                const tmpMode = backgroundSettings.getString('picture-options');

                // Force HydraPaper to target a different resulting image by using darkmode
                await this._hydraPaper.run(newWallpaperPaths, true);

                newWallpaperPaths.forEach(path => {
                    if (!usedWallpaperPaths.includes(path))
                        usedWallpaperPaths.push(path);
                });

                screensaverSettings.setString('picture-options', 'spanned');
                this._setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri-dark'));

                // HydraPaper possibly changed these, change them back
                backgroundSettings.setString('picture-uri-dark', tmpBackground);
                backgroundSettings.setString('picture-options', tmpMode);
            } else {
                // set "picture-options" to "zoom" for single wallpapers
                screensaverSettings.setString('picture-options', 'zoom');
                this._setPictureUriOfSettingsObject(screensaverSettings, wallpaperUri);
                if (!usedWallpaperPaths.includes(wallpaperUri))
                    usedWallpaperPaths.push(wallpaperUri);
            }
        }

        if (changeType === 2)
            this._setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri'));

        // TODO: this ignores the lock-screen
        // Run general post command
        const commandString = this._settings.getString('general-post-command');
        const generalPostCommandArray = this._getCommandArray(commandString, backgroundSettings.getString('picture-uri'));
        if (generalPostCommandArray !== null) {
            try {
                await Utils.execCheck(generalPostCommandArray);
            } catch (error) {
                this._logger.warn(String(error));
            }
        }

        return usedWallpaperPaths;
    }

    private _fillMonitorsFromHistory(wallpaperArray: string[], monitorCount: number) {
        const newWallpaperArray: string[] = [...wallpaperArray];

        // Abuse history to fill missing images
        for (let index = newWallpaperArray.length; index < monitorCount; index++) {
            let historyElement;
            do
                historyElement = this._historyController.getRandom();
            while (this._historyController.history.length > monitorCount && historyElement.path && newWallpaperArray.includes(historyElement.path));
            // ensure different wallpaper for all displays if possible

            if (historyElement.path)
                newWallpaperArray.push(historyElement.path);
        }

        return newWallpaperArray;
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

    async setWallpaper(historyId: string) {
        const historyElement = this._historyController.get(historyId);

        if (historyElement?.id && historyElement.path && this._historyController.promoteToActive(historyElement.id)) {
            const monitorCount = this._settings.getBoolean('multiple-displays') && this._hydraPaper.isAvailable() ? Utils.getMonitorCount() : 1;
            const usedWallpapers = (await this._setBackground([historyElement.path], monitorCount)).reverse();
            usedWallpapers.forEach(path => {
                const id = this._historyController.getEntryByPath(path)?.id;
                if (id)
                    this._historyController.promoteToActive(id);
            });
        } else {
            this._logger.warn(`The history id (${historyId}) could not be found.`);
        }
        // TODO: Error handling history id not found.
    }

    async fetchNewWallpaper() {
        this._startLoadingHooks.forEach(element => element());

        try {
            this._timer.reset(); // reset timer

            const monitorCount = this._settings.getBoolean('multiple-displays') && this._hydraPaper.isAvailable() ? Utils.getMonitorCount() : 1;
            const imageAdapters = this._getRandomAdapter(monitorCount);

            const randomImagePromises = imageAdapters.map(element => {
                return element.adapter.requestRandomImage(element.imageCount);
            });
            const newWallpapers = await Promise.all(randomImagePromises);

            const fetchPromises = newWallpapers.flatMap((array, index) => {
                const fetchPromiseArray: Promise<HistoryModule.HistoryEntry>[] = [];

                for (const element of array) {
                    element.adapter.id = imageAdapters[index].id;
                    element.adapter.type = imageAdapters[index].type;

                    this._logger.info(`Requesting image: ${element.source.imageDownloadUrl}`);
                    fetchPromiseArray.push(imageAdapters[index].adapter.fetchFile(element));
                }

                return fetchPromiseArray;
            });

            // wait for all fetching images
            // FIXME: shove this into the adapter itself so rate limiting can be adjusted
            const newImageEntries = await Promise.all(fetchPromises);

            // Move file to unique naming
            const movePromises = newImageEntries.map(entry => {
                if (!entry.path)
                    return Promise.resolve(false);

                const file = Gio.File.new_for_path(entry.path);
                const targetFolder = file.get_parent();
                const targetFile = targetFolder?.get_child(entry.id);

                if (!targetFile)
                    throw new Error('Failed getting targetFile');

                entry.path = targetFile.get_path();

                // This function is Gio._promisified
                return file.move_async(targetFile, Gio.FileCopyFlags.NONE, 0, null, null);
            });

            // wait for all images to be moved
            await Promise.all(movePromises);

            const wallpaperPaths = newImageEntries.map(element => {
                if (element.path)
                    return element.path;

                // eslint-disable-next-line
                return;
            }) as string[]; // cast because we made sure it's defined
            const usedWallpapers = (await this._setBackground(wallpaperPaths, monitorCount)).reverse();

            usedWallpapers.forEach(path => {
                const id = this._historyController.getEntryByPath(path)?.id;
                if (id)
                    this._historyController.promoteToActive(id);
            });

            // insert new wallpapers into history
            newImageEntries.reverse().forEach(element => {
                this._historyController.insert(element);
            });
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

            const currentWallpaperPaths: string[] = [];
            for (let index = 0; index < Utils.getMonitorCount() && index < this._historyController.history.length; index++) {
                const path = this._historyController.history[index].path;
                if (path)
                    currentWallpaperPaths.push(path);
            }

            if (this._resetWallpaper) {
                this._setBackground(currentWallpaperPaths, 1).catch(logError);
                this._resetWallpaper = false;
            } else if (this._previewId !== undefined) {
                this._setBackground([this.wallpaperLocation + this._previewId], Utils.getMonitorCount()).catch(logError);
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
