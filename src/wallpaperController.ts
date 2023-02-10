import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';

import * as ExtensionUtils from '@gi/misc/extensionUtils';

import * as HistoryModule from './history.js';
import * as SettingsModule from './settings.js';
import * as Utils from './utils.js';

import {AFTimer as Timer} from './timer.js';
import {getWallpaperManager} from './manager/wallpaperManager.js';
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
    private _historyController: HistoryModule.HistoryController;
    private _wallpaperManager = getWallpaperManager();
    private _autoFetch = {active: false, duration: 30};
    private _previewId: string | undefined;
    private _resetWallpaper = false;
    private _timeout: number | null = null;
    /** functions will be called upon loading a new wallpaper */
    private _startLoadingHooks: (() => void)[] = [];
    /** functions will be called when loading a new wallpaper stopped. */
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
        this._backendConnection.observe('request-new-wallpaper', () => this._requestNewWallpaper().catch(this._logger.error));

        this._settings.observe('history-length', () => this._updateHistory());
        this._settings.observe('auto-fetch', () => this._updateAutoFetching());
        this._settings.observe('minutes', () => this._updateAutoFetching());
        this._settings.observe('hours', () => this._updateAutoFetching());

        this._updateHistory();
        this._updateAutoFetching();

        // load a new wallpaper on startup
        if (this._settings.getBoolean('fetch-on-startup'))
            this.fetchNewWallpaper().catch(this._logger.error);

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
            this._timer.pause();
        } else {
            this._timer.continue();

            // Switching the switch in the menu closes the menu which triggers a hover event
            // Prohibit that from emitting because a paused timer could have surpassed the interval
            // and try to fetch new wallpaper which would be interrupted by a wallpaper reset caused
            // by the closing menu event.
            this.prohibitNewWallpaper = true;

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
        if (this._autoFetch.active) {
            this._timer.registerCallback(() => {
                return this.fetchNewWallpaper();
            });
            this._timer.setMinutes(this._autoFetch.duration);
            this._timer.start().catch(this._logger.error);
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
     * Types:
     * 0: Background
     * 1: Lock screen
     * 2: Background and lock screen
     *
     * @param {string[]} wallpaperPaths Array of paths to the image
     * @param {number} type Types to change
     */
    private async _setBackground(wallpaperPaths: string[], type: number = 0) {
        const backgroundSettings = new SettingsModule.Settings('org.gnome.desktop.background');
        const screensaverSettings = new SettingsModule.Settings('org.gnome.desktop.screensaver');

        if (wallpaperPaths.length < 1)
            throw new Error('Empty wallpaper array');

        const wallpaperUri = `file://${wallpaperPaths[0]}`;

        if (wallpaperPaths.length > 1 && this._wallpaperManager) {
            await this._wallpaperManager.setWallpaper(wallpaperPaths, type, backgroundSettings, screensaverSettings);
            return;
        }

        if (type === 0 || type === 2) {
            // FIXME: These are currently hardcoded for the few available wallpaperManager
            if (wallpaperUri.includes('merged_wallpaper') || wallpaperUri.includes('cli-a') || wallpaperUri.includes('cli-b'))
            // merged wallpapers need mode "spanned"
                backgroundSettings.setString('picture-options', 'spanned');
            else
            // single wallpapers need mode "zoom"
                backgroundSettings.setString('picture-options', 'zoom');

            Utils.setPictureUriOfSettingsObject(backgroundSettings, wallpaperUri);
        }

        if (type === 1) {
            // FIXME: These are currently hardcoded for the few available wallpaperManager
            if (wallpaperUri.includes('merged_wallpaper') || wallpaperUri.includes('cli-a') || wallpaperUri.includes('cli-b'))
            // merged wallpapers need mode "spanned"
                screensaverSettings.setString('picture-options', 'spanned');
            else
            // single wallpapers need mode "zoom"
                screensaverSettings.setString('picture-options', 'zoom');

            Utils.setPictureUriOfSettingsObject(screensaverSettings, wallpaperUri);
        }

        if (type === 2) {
            // FIXME: These are currently hardcoded for the few available wallpaperManager
            if (wallpaperUri.includes('merged_wallpaper') || wallpaperUri.includes('cli-a') || wallpaperUri.includes('cli-b'))
                // merged wallpapers need mode "spanned"
                screensaverSettings.setString('picture-options', 'spanned');
            else
                // single wallpapers need mode "zoom"
                screensaverSettings.setString('picture-options', 'zoom');

            Utils.setPictureUriOfSettingsObject(screensaverSettings, backgroundSettings.getString('picture-uri'));
        }
    }

    // Run general post command
    private _runPostCommands() {
        const backgroundSettings = new SettingsModule.Settings('org.gnome.desktop.background');
        const commandString = this._settings.getString('general-post-command');

        // Read the current wallpaper uri from settings because it could be a merged wallpaper
        // Remove prefix "file://" to get the real path
        const currentWallpaperPath = backgroundSettings.getString('picture-uri').slice(7);

        // TODO: this ignores the lock-screen
        const generalPostCommandArray = this._getCommandArray(commandString, currentWallpaperPath);
        if (generalPostCommandArray !== null) {
            // Do not await this call, let it be one shot
            Utils.execCheck(generalPostCommandArray).catch(this._logger.error);
        }
    }

    private _fillDisplaysFromHistory(wallpaperArray: string[], requestCount?: number) {
        const count = requestCount ?? this._getCurrentDisplayCount();
        const newWallpaperArray: string[] = [...wallpaperArray];

        // Abuse history to fill missing images
        for (let index = newWallpaperArray.length; index < count; index++) {
            let historyElement: HistoryModule.HistoryEntry;
            do
                historyElement = this._historyController.getRandom();
            while (this._historyController.history.length > count && historyElement.path && newWallpaperArray.includes(historyElement.path));
            // try to ensure different wallpaper for all displays if possible

            if (historyElement.path)
                newWallpaperArray.push(historyElement.path);
        }

        // Trim array if we have too many images, possibly by having a too long input array
        return newWallpaperArray.slice(0, count);
    }

    async setWallpaper(historyId: string) {
        const historyElement = this._historyController.get(historyId);

        if (historyElement?.id && historyElement.path && this._historyController.promoteToActive(historyElement.id)) {
            const changeType = this._settings.getEnum('change-type');
            const usedWallpaperPaths = this._fillDisplaysFromHistory([historyElement.path]);

            // ignore changeType === 3 because that doesn't make sense
            // when requesting a specific history entry
            if (changeType > 2)
                await this._setBackground(usedWallpaperPaths, 2);
            else
                await this._setBackground(usedWallpaperPaths, changeType);

            this._runPostCommands();
            usedWallpaperPaths.reverse().forEach(path => {
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
            // <value value='0' nick='Background' />
            // <value value='1' nick='Lock Screen' />
            // <value value='2' nick='Background and Lock Screen' />
            // <value value='3' nick='Background and Lock Screen independently' />
            const changeType = this._settings.getEnum('change-type');
            let monitorCount = this._getCurrentDisplayCount();

            // Request double the amount of displays if we need background and lock screen
            if (changeType === 3)
                monitorCount *= 2;

            const imageAdapters = this._getRandomAdapter(monitorCount);

            const randomImagePromises = imageAdapters.map(element => {
                return element.adapter.requestRandomImage(element.imageCount);
            });
            const newWallpapers = await Promise.all(randomImagePromises);

            const fetchPromises = newWallpapers.flatMap((array, index) => {
                const fetchPromiseArray: Promise<HistoryModule.HistoryEntry>[] = [];

                for (const element of array) {
                    element.adapter = {
                        id: imageAdapters[index].id,
                        type: imageAdapters[index].type,
                    };

                    this._logger.debug(`Requesting image: ${element.source.imageDownloadUrl}`);
                    fetchPromiseArray.push(imageAdapters[index].adapter.fetchFile(element));
                }

                return fetchPromiseArray;
            });

            // wait for all fetching images
            const newImageEntries = await Promise.all(fetchPromises);
            this._logger.info(`Requested ${newImageEntries.length} new images.`);

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

            const newWallpaperPaths = newImageEntries.map(element => {
                if (element.path)
                    return element.path;

                // eslint-disable-next-line
                return;
            }) as string[]; // cast because we made sure it's defined
            const usedWallpaperPaths = this._fillDisplaysFromHistory(newWallpaperPaths, monitorCount);

            if (changeType === 3) {
                // Half the images for the background
                await this._setBackground(usedWallpaperPaths.slice(0, monitorCount / 2), 0);
                // Half the images for the lock screen
                await this._setBackground(usedWallpaperPaths.slice(monitorCount / 2), 1);
            } else {
                await this._setBackground(usedWallpaperPaths, changeType);
            }

            usedWallpaperPaths.reverse().forEach(path => {
                const id = this._historyController.getEntryByPath(path)?.id;
                if (id)
                    this._historyController.promoteToActive(id);
            });

            // insert new wallpapers into history
            this._historyController.insert(newImageEntries.reverse());

            this._runPostCommands();
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

    /**
     * Get the current number of displays.
     *
     * This also takes the user setting and HydraPaper availability into account
     * and lies accordingly by reporting only 1 display.
     */
    private _getCurrentDisplayCount() {
        if (!this._settings.getBoolean('multiple-displays'))
            return 1;

        if (!this._wallpaperManager?.isAvailable())
            return 1;

        return Utils.getMonitorCount();
    }

    private _backgroundTimeout(paths?: string[], delay?: number) {
        if (this._timeout || !paths)
            return;

        delay = delay || 200;

        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._timeout = null;

            // Only change the background - the lock screen wouldn't be visible anyway
            // because this function is only used for hover preview
            if (this._resetWallpaper) {
                this._setBackground(paths, 0).catch(this._logger.error);
                this._resetWallpaper = false;
            } else if (this._previewId !== undefined) {
                this._setBackground(paths, 0).catch(this._logger.error);
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    previewWallpaper(historyId: string, delay?: number) {
        if (!this._settings.getBoolean('disable-hover-preview')) {
            this._previewId = historyId;
            this._resetWallpaper = false;

            // Do not fill other displays here.
            // This is so HydraPaper will not overwrite the current merged background path
            // with the preview image.
            // We could move the image to a safe place with caveats:
            // * temporarily (seems expensive for a simple preview)
            // TODO: verify: * permanently (would break HydraPaperDaemon)
            const newWallpaperPaths = [this.wallpaperLocation + this._previewId];

            this._backgroundTimeout(newWallpaperPaths, delay);
        }
    }

    resetWallpaper(uri: string) {
        if (!this._settings.getBoolean('disable-hover-preview')) {
            this._resetWallpaper = true;
            this._backgroundTimeout([GLib.filename_from_uri(uri)[0]]);
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
