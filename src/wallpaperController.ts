import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Legacy importing style for shell internal bindings not available in standard import format
const ExtensionUtils = imports.misc.extensionUtils;

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

/**
 * The main wallpaper handler.
 */
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

    /**
     * Create a new controller.
     *
     * Should only exists once to avoid weird shenanigans because the extension background
     * and preferences page existing in two different contexts.
     */
    constructor() {
        let xdg_cache_home = GLib.getenv('XDG_CACHE_HOME');
        if (!xdg_cache_home) {
            const home = GLib.getenv('HOME');

            if (home)
                xdg_cache_home = `${home}/.cache`;
            else
                xdg_cache_home = '/tmp';
        }

        this.wallpaperLocation = `${xdg_cache_home}/${Self.metadata['uuid']}/wallpapers/`;
        const mode = 0o0755;
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
        this._backendConnection.observe('request-new-wallpaper', () => this._requestNewWallpaper().catch(error => {
            this._logger.error(error);
        }));

        this._settings.observe('history-length', () => this._updateHistory());
        this._settings.observe('auto-fetch', () => this._updateAutoFetching());
        this._settings.observe('minutes', () => this._updateAutoFetching());
        this._settings.observe('hours', () => this._updateAutoFetching());

        this._updateHistory();
        this._updateAutoFetching();

        // load a new wallpaper on startup
        if (this._settings.getBoolean('fetch-on-startup')) {
            this.fetchNewWallpaper().catch(error => {
                this._logger.error(error);
            });
        }

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

    /**
     * Empty the history. (Background settings observer edition)
     */
    private _clearHistory(): void {
        if (this._backendConnection.getBoolean('clear-history')) {
            this.update();
            this.deleteHistory();
            this._backendConnection.setBoolean('clear-history', false);
        }
    }

    /**
     * Open the internal wallpaper cache folder. (Background settings observer edition)
     */
    private _openFolder(): void {
        if (this._backendConnection.getBoolean('open-folder')) {
            const uri = GLib.filename_to_uri(this.wallpaperLocation, '');
            Gio.AppInfo.launch_default_for_uri(uri, Gio.AppLaunchContext.new());
            this._backendConnection.setBoolean('open-folder', false);
        }
    }

    /**
     * Pause or resume the timer. (Background settings observer edition)
     */
    private _pauseTimer(): void {
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

    /**
     * Get a fresh wallpaper. (Background settings observer edition)
     */
    private async _requestNewWallpaper(): Promise<void> {
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

    /**
     * Update the history.
     *
     * Loads from settings.
     */
    private _updateHistory(): void {
        this._historyController.load();
    }

    /**
     * Update settings related to the auto fetching.
     */
    private _updateAutoFetching(): void {
        let duration = 0;
        duration += this._settings.getInt('minutes');
        duration += this._settings.getInt('hours') * 60;
        this._autoFetch.duration = duration;
        this._autoFetch.active = this._settings.getBoolean('auto-fetch');

        if (this._autoFetch.active) {
            this._timer.registerCallback(() => {
                return this.fetchNewWallpaper();
            });
            this._timer.setMinutes(this._autoFetch.duration);
            this._timer.start().catch(error => {
                this._logger.error(error);
            });
        } else {
            this._timer.stop();
        }
    }

    /**
     * Get an array of random adapter needed to fill the display $count.
     *
     * A single adapter can be assigned for multiple images so you may get less than $count adapter back.
     *
     * Returns a default UnsplashAdapter in case of failure.
     *
     * @param {number} count The amount of wallpaper requested
     * @returns {RandomAdapterResult[]} Array of info objects how many images are needed for each adapter
     */
    private _getRandomAdapter(count: number): RandomAdapterResult[] {
        const sourceIDs = this._getRandomSource(count);
        const randomAdapterResult: RandomAdapterResult[] = [];

        if (sourceIDs.length < 1 || sourceIDs[0] === '-1') {
            randomAdapterResult.push({
                adapter: new UnsplashAdapter(null, null),
                id: '-1',
                type: 0,
                imageCount: count,
            });
            return randomAdapterResult;
        }

        /**
         * Check if we've chosen the same adapter type before.
         *
         * @param {RandomAdapterResult[]} array Array of already chosen adapter
         * @param {number} type Type of the source
         * @returns {RandomAdapterResult | null} Found adapter or null
         */
        function _arrayIncludes(array: RandomAdapterResult[], type: number): RandomAdapterResult | null {
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
            sourceType = settingsGeneral.getInt('type');

            const availableAdapter = _arrayIncludes(randomAdapterResult, sourceType);
            if (availableAdapter) {
                availableAdapter.imageCount++;
                continue;
            }

            try {
                switch (sourceType) {
                case Utils.SourceType.UNSPLASH:
                    imageSourceAdapter = new UnsplashAdapter(sourceID, sourceName);
                    break;
                case Utils.SourceType.WALLHAVEN:
                    imageSourceAdapter = new WallhavenAdapter(sourceID, sourceName);
                    break;
                case Utils.SourceType.REDDIT:
                    imageSourceAdapter = new RedditAdapter(sourceID, sourceName);
                    break;
                case Utils.SourceType.GENERIC_JSON:
                    imageSourceAdapter = new GenericJsonAdapter(sourceID, sourceName);
                    break;
                case Utils.SourceType.LOCAL_FOLDER:
                    imageSourceAdapter = new LocalFolderAdapter(sourceID, sourceName);
                    break;
                case Utils.SourceType.STATIC_URL:
                    imageSourceAdapter = new UrlSourceAdapter(sourceID, sourceName);
                    break;
                default:
                    imageSourceAdapter = new UnsplashAdapter(null, null);
                    sourceType = 0;
                    break;
                }
            } catch (error) {
                this._logger.warn('Had errors, fetching with default settings.');
                imageSourceAdapter = new UnsplashAdapter(null, null);
                sourceType = Utils.SourceType.UNSPLASH;
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
     * Gets randomly $count amount of enabled sources.
     *
     * The same source can appear multiple times in the resulting array.
     *
     * @param {number} count Amount of requested source IDs
     * @returns {string[]} Array of source IDs or ['-1'] in case of failure
     */
    private _getRandomSource(count: number): string[] {
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
    private async _setBackground(wallpaperPaths: string[], type: number = 0): Promise<void> {
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

    /**
     * Run a configured post command.
     */
    private _runPostCommands(): void {
        const backgroundSettings = new SettingsModule.Settings('org.gnome.desktop.background');
        const commandString = this._settings.getString('general-post-command');

        // Read the current wallpaper uri from settings because it could be a merged wallpaper
        // Remove prefix "file://" to get the real path
        const currentWallpaperPath = backgroundSettings.getString('picture-uri').replace(/^file:\/\//, '');

        // TODO: this ignores the lock-screen
        const generalPostCommandArray = this._getCommandArray(commandString, currentWallpaperPath);
        if (generalPostCommandArray !== null) {
            // Do not await this call, let it be one shot
            Utils.execCheck(generalPostCommandArray).catch(error => {
                this._logger.error(error);
            });
        }
    }

    /**
     * Fill an array with images from the history until $count.
     *
     * @param {string[]} wallpaperArray Array of wallpaper paths
     * @param {number | undefined} requestCount Amount of wallpaper paths $wallpaperArray should contain, defaults to the value reported by _getCurrentDisplayCount()
     * @returns {string[]} Array of wallpaper paths matching the length of $count
     */
    private _fillDisplaysFromHistory(wallpaperArray: string[], requestCount?: number): string[] {
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

    /**
     * Set an existing history entry as wallpaper.
     *
     * @param {string} historyId Unique ID
     */
    async setWallpaper(historyId: string): Promise<void> {
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

    /**
     * Fetch fresh wallpaper.
     */
    async fetchNewWallpaper(): Promise<void> {
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
            const newWallpapers = await Promise.allSettled(randomImagePromises);

            const fetchPromises = newWallpapers.flatMap((object, index) => {
                const fetchPromiseArray: Promise<HistoryModule.HistoryEntry>[] = [];
                let array: HistoryModule.HistoryEntry[] = [];

                // rejected promises
                if ('reason' in object && Array.isArray(object.reason) && object.reason.length > 0 && object.reason[0] instanceof HistoryModule.HistoryEntry)
                    array = object.reason as HistoryModule.HistoryEntry[];

                // fulfilled promises
                if ('value' in object)
                    array = object.value;

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

            if (fetchPromises.length < 1)
                throw new Error('Unable to request new images.');

            // wait for all fetching images
            this._logger.info(`Requesting ${fetchPromises.length} new images.`);
            const newImageEntriesPromiseResults = await Promise.allSettled(fetchPromises);

            const newImageEntries = newImageEntriesPromiseResults.map(element => {
                if (element.status !== 'fulfilled' && !('value' in element))
                    return null;

                return element.value;
            }).filter(element => {
                return element instanceof HistoryModule.HistoryEntry;
            }) as HistoryModule.HistoryEntry[];

            this._logger.debug(`Fetched ${newImageEntries.length} new images.`);
            const newWallpaperPaths = newImageEntries.map(element => {
                return element.path;
            });

            if (newWallpaperPaths.length < 1)
                throw new Error('Unable to fetch new images.');

            if (newWallpaperPaths.length < monitorCount)
                this._logger.warn('Unable to fill all displays with new images.');

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
        } catch (error) {
            this._logger.error(error);
        } finally {
            this._stopLoadingHooks.forEach(element => element());
        }
    }

    // TODO: Change to original historyElement if more variable get exposed
    /**
     * Get a command array from a string.
     *
     * Fills variables if found:
     * - %wallpaper_path%
     *
     * @param {string} commandString String to parse an array from
     * @param {string} historyElementPath Wallpaper path to fill into the variable
     * @returns {string[] | null} Command array or null
     */
    private _getCommandArray(commandString: string, historyElementPath: string): string[] | null {
        let string = commandString;
        if (string === '')
            return null;

        // Replace variables
        const variables = new Map<string, string>();
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
     * This also takes the user setting and wallpaper manager availability into account
     * and lies accordingly by reporting only 1 display.
     *
     * @returns {number} Amount of currently activated displays or 1
     */
    private _getCurrentDisplayCount(): number {
        if (!this._settings.getBoolean('multiple-displays'))
            return 1;

        if (!this._wallpaperManager?.isAvailable())
            return 1;

        return Utils.getMonitorCount();
    }

    /**
     * Set a background after a $delay
     *
     * Prohibits quick wallpaper changing by blocking additional change requests
     * within a timeout.
     *
     * @param {string[] | undefined} paths Array of wallpaper paths
     * @param {number | undefined} delay Delay, defaults to 200ms
     */
    private _backgroundTimeout(paths?: string[], delay?: number): void {
        if (this._timeout || !paths)
            return;

        delay = delay || 200;

        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._timeout = null;

            // Only change the background - the lock screen wouldn't be visible anyway
            // because this function is only used for hover preview
            if (this._resetWallpaper) {
                this._setBackground(paths, 0).catch(error => {
                    this._logger.error(error);
                });
                this._resetWallpaper = false;
            } else if (this._previewId !== undefined) {
                this._setBackground(paths, 0).catch(error => {
                    this._logger.error(error);
                });
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Preview an image in the history.
     *
     * @param {string} historyId Unique ID
     * @param {number} delay Delay, defaults to 200ms
     */
    previewWallpaper(historyId: string, delay?: number): void {
        if (!this._settings.getBoolean('disable-hover-preview')) {
            this._previewId = historyId;
            this._resetWallpaper = false;

            // Do not fill other displays here.
            // Merging images can take a long time and hurt the quick preview purpose.
            // Therefor only an array with a single wallpaper path here:
            const newWallpaperPaths = [this.wallpaperLocation + this._previewId];

            this._backgroundTimeout(newWallpaperPaths, delay);
        }
    }

    /**
     * Set the wallpaper to an URI.
     *
     * @param {string} uri Wallpaper URI
     */
    resetWallpaper(uri: string): void {
        if (!this._settings.getBoolean('disable-hover-preview')) {
            this._resetWallpaper = true;
            // FIXME: With an already running timeout this reset request will be ignored
            this._backgroundTimeout([GLib.filename_from_uri(uri)[0]]);
        }
    }

    /**
     * Get the HistoryController.
     *
     * @returns {HistoryModule.HistoryController} The history controller
     */
    getHistoryController(): HistoryModule.HistoryController {
        return this._historyController;
    }

    /**
     * Empty the history.
     */
    deleteHistory(): void {
        this._historyController.clear();
    }

    /**
     * Update the history.
     */
    update(): void {
        this._updateHistory();
    }

    /**
     * Register a function which gets called on wallpaper fetching.
     *
     * Can take multiple hooks.
     *
     * @param {() => void} fn Function to call
     */
    registerStartLoadingHook(fn: () => void): void {
        if (typeof fn === 'function')
            this._startLoadingHooks.push(fn);
    }

    /**
     * Register a function which gets called when done wallpaper fetching.
     *
     * Can take multiple hooks.
     *
     * @param {() => void} fn Function to call
     */
    registerStopLoadingHook(fn: () => void): void {
        if (typeof fn === 'function')
            this._stopLoadingHooks.push(fn);
    }
}

export {WallpaperController};
