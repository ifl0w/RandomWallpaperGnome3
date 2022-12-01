const Mainloop = imports.gi.GLib;

// Filesystem
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const HistoryModule = Self.imports.history;
const LoggerModule = Self.imports.logger;
const Prefs = Self.imports.settings;
const Utils = Self.imports.utils;
const Timer = Self.imports.timer;

// SourceAdapter
const GenericJsonAdapter = Self.imports.adapter.genericJson;
const LocalFolderAdapter = Self.imports.adapter.localFolder;
const RedditAdapter = Self.imports.adapter.reddit;
const UnsplashAdapter = Self.imports.adapter.unsplash;
const UrlSourceAdapter = Self.imports.adapter.urlSource;
const WallhavenAdapter = Self.imports.adapter.wallhaven;

var WallpaperController = class {
	_backendConnection = null;
	_prohibitTimer = false;

	constructor() {
		this.logger = new LoggerModule.Logger('RWG3', 'WallpaperController');
		let xdg_cache_home = Mainloop.getenv('XDG_CACHE_HOME')
		if (!xdg_cache_home) {
			xdg_cache_home = `${Mainloop.getenv('HOME')}/.cache`
		}
		this.wallpaperLocation = `${xdg_cache_home}/${Self.metadata['uuid']}/wallpapers/`;
		let mode = parseInt('0755', 8);
		Mainloop.mkdir_with_parents(this.wallpaperLocation, mode)

		this._autoFetch = {
			active: false,
			duration: 30,
		};

		// functions will be called upon loading a new wallpaper
		this._startLoadingHooks = [];
		// functions will be called when loading a new wallpaper stopped. If an error occurred then the error will be passed as parameter.
		this._stopLoadingHooks = [];

		this._backendConnection = new Prefs.Settings(Prefs.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);

		// Bring values to defined stage
		this._backendConnection.set('clear-history', 'boolean', false);
		this._backendConnection.set('open-folder', 'boolean', false);
		this._backendConnection.set('pause-timer', 'boolean', false);
		this._backendConnection.set('request-new-wallpaper', 'boolean', false);

		// Track value changes
		this._backendConnection.observe('clear-history', () => this._clearHistory());
		this._backendConnection.observe('open-folder', () => this._openFolder());
		this._backendConnection.observe('pause-timer', () => this._pauseTimer());
		this._backendConnection.observe('request-new-wallpaper', () => this._requestNewWallpaper());

		this._timer = new Timer.AFTimer();
		this._historyController = new HistoryModule.HistoryController(this.wallpaperLocation);

		this._settings = new Prefs.Settings();
		this._settings.observe('history-length', () => this._updateHistory());
		this._settings.observe('auto-fetch', () => this._updateAutoFetching());
		this._settings.observe('minutes', () => this._updateAutoFetching());
		this._settings.observe('hours', () => this._updateAutoFetching());

		this._updateHistory();
		this._updateAutoFetching();

		// load a new wallpaper on startup
		if (this._settings.get("fetch-on-startup", "boolean")) {
			this.fetchNewWallpaper();
		}

		// Initialize favorites folder
		// TODO: There's probably a better place for this
		let favoritesFolder = this._settings.get('favorites-folder', 'string');
		if (favoritesFolder === "") {
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

			this._settings.set('favorites-folder', 'string', favoritesFolder.get_path());
		}

		try {
			Utils.Utils.getHydraPaperAvailable().then(result => {
				this.logger.debug(`HydraPaper available: ${result}`);
			});
		} catch (error) {
			this.logger.warn(error);
		}
	}

	_clearHistory() {
		if (this._backendConnection.get('clear-history', 'boolean')) {
			this.update();
			this.deleteHistory();
			this._backendConnection.set('clear-history', 'boolean', false);
		}
	}

	_openFolder() {
		if (this._backendConnection.get('open-folder', 'boolean')) {
			let uri = GLib.filename_to_uri(this.wallpaperLocation, "");
			Gio.AppInfo.launch_default_for_uri(uri, Gio.AppLaunchContext.new());
			this._backendConnection.set('open-folder', 'boolean', false);
		}
	}

	_pauseTimer() {
		if (this._backendConnection.get('pause-timer', 'boolean')) {
			this._prohibitTimer = true;
			this._updateAutoFetching();
		} else {
			this._prohibitTimer = false;
			this._updateAutoFetching();
		}
	}

	_requestNewWallpaper() {
		if (this._backendConnection.get('request-new-wallpaper', 'boolean')) {
			this.update();
			this.fetchNewWallpaper(() => {
				this.update();
				this._backendConnection.set('request-new-wallpaper', 'boolean', false);
			});
		}
	}

	_updateHistory() {
		this._historyController.load();
	}

	_updateAutoFetching() {
		let duration = 0;
		duration += this._settings.get('minutes', 'int');
		duration += this._settings.get('hours', 'int') * 60;
		this._autoFetch.duration = duration;
		this._autoFetch.active = this._settings.get('auto-fetch', 'boolean');

		// only start timer if not in context of preferences window
		if (!this._prohibitTimer && this._autoFetch.active) {
			this._timer.registerCallback(() => this.fetchNewWallpaper());
			this._timer.setMinutes(this._autoFetch.duration);
			this._timer.start();
		} else {
			this._timer.stop();
		}
	}

	/*
	 randomly returns an enabled and configured SourceAdapter
	 returns a default UnsplashAdapter in case of failure
	 */
	_getRandomAdapter() {
		let imageSourceAdapter = null;
		let sourceID = this._getRandomSource();

		let path = `${Prefs.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${sourceID}/`;
		let settingsGeneral = new Prefs.Settings(Prefs.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);

		let sourceName = settingsGeneral.get('name', 'string');
		let sourceType = settingsGeneral.get('type', 'enum');

		if (sourceID === -1) {
			sourceType = null;
		}

		try {
			switch (sourceType) {
				case 0:
					imageSourceAdapter = new UnsplashAdapter.UnsplashAdapter(sourceID, sourceName, this.wallpaperLocation);
					break;
				case 1:
					imageSourceAdapter = new WallhavenAdapter.WallhavenAdapter(sourceID, sourceName, this.wallpaperLocation);
					break;
				case 2:
					imageSourceAdapter = new RedditAdapter.RedditAdapter(sourceID, sourceName, this.wallpaperLocation);
					break;
				case 3:
					imageSourceAdapter = new GenericJsonAdapter.GenericJsonAdapter(sourceID, sourceName, this.wallpaperLocation);
					break;
				case 4:
					imageSourceAdapter = new LocalFolderAdapter.LocalFolderAdapter(sourceID, sourceName, this.wallpaperLocation);
					break;
				case 5:
					imageSourceAdapter = new UrlSourceAdapter.UrlSourceAdapter(sourceID, sourceName, this.wallpaperLocation);
					break;
				default:
					imageSourceAdapter = new UnsplashAdapter.UnsplashAdapter(null, null, this.wallpaperLocation);
					sourceType = 0;
					break;
			}
		} catch (error) {
			this.logger.warn("Had errors, fetching with default settings.");
			imageSourceAdapter = new UnsplashAdapter.UnsplashAdapter(null, null, this.wallpaperLocation);
			sourceType = 0;
		}

		return {
			adapter: imageSourceAdapter,
			adapterId: sourceID,
			adapterType: sourceType
		};
	}

	_getRandomSource() {
		let sources = this._settings.get('sources', 'strv');

		if (sources === null || sources.length < 1) {
			return -1;
		}

		let enabled_sources = sources.filter(element => {
			let path = `${Prefs.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${element}/`;
			let settingsGeneral = new Prefs.Settings(Prefs.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);
			return settingsGeneral.get('enabled', 'boolean');
		});

		if (enabled_sources === null || enabled_sources.length < 1) {
			return -1;
		}

		// https://stackoverflow.com/a/5915122
		return enabled_sources[Utils.Utils.getRandomNumber(enabled_sources.length)];
	}

	/**
	 * Sets the wallpaper and the lockscreen when enabled to the given path. Executes the callback on success.
	 * @param path
	 * @param callback
	 * @private
	 */
	async _setBackground(path, callback) {
		let monitorCount = Utils.Utils.getMonitorCount();
		let background_setting = new Gio.Settings({ schema: "org.gnome.desktop.background" });
		let wallpaperUri = "file://" + path;

		try {
			if (this._settings.get('multiple-displays', 'boolean') && await Utils.Utils.getHydraPaperAvailable()) {
				// Needs a copy here
				let hydraPaperCommand = [...Utils.Utils.getHydraPaperCommand()];

				hydraPaperCommand.push('--cli');
				hydraPaperCommand.push(path);

				// Abuse history to fill missing images
				for (let index = 0; index < monitorCount - 1; index++) {
					let historyElement;
					do {
						historyElement = this._historyController.getRandom();
					} while (this._historyController.history.length > monitorCount && hydraPaperCommand.includes(historyElement.path, 1))
					// ensure different wallpaper for all displays if possible

					hydraPaperCommand.push(historyElement.path);
				}

				try {
					// hydrapaper [--darkmode] --cli PATH PATH PATH
					await Utils.Utils.runCommand(hydraPaperCommand);
				} catch (error) {
					this.logger.warn(error);
				}

				// Manually set key for darkmode because that's way faster
				background_setting.set_string("picture-uri-dark", background_setting.get_string("picture-uri"));
			} else {
				// set "picture-options" to "zoom" for single wallpapers
				// hydrapaper changes this to "spanned"
				background_setting.set_string('picture-options', 'zoom');

				this._setPictureUriOfSettingsObject(background_setting, wallpaperUri);
			}
		} catch (error) {
			this.logger.warn(error);
		}

		if (this._settings.get('change-lock-screen', 'boolean')) {
			let screensaver_setting = new Gio.Settings({ schema: "org.gnome.desktop.screensaver" });
			this._setPictureUriOfSettingsObject(screensaver_setting, wallpaperUri);
		}

		// Run general post command
		let commandString = this._settings.get('general-post-command', 'string');
		let generalPostCommandArray = this._getCommandArray(commandString, path);
		if (generalPostCommandArray !== null) {
			try {
				await Utils.Utils.runCommand(generalPostCommandArray);
			} catch (error) {
				this.logger.warn(error);
			}
		}

		// call callback if given
		if (callback) {
			callback();
		}
	}

	/**
	 * Set the picture-uri property of the given settings object to the path.
	 * Precondition: the settings object has to be a valid Gio settings object with the picture-uri property.
	 * @param settings
	 * @param path
	 * @param callback
	 * @private
	 */
	_setPictureUriOfSettingsObject(settings, path, callback) {
		/*
		 inspired from:
		 https://bitbucket.org/LukasKnuth/backslide/src/7e36a49fc5e1439fa9ed21e39b09b61eca8df41a/backslide@codeisland.org/settings.js?at=master
		 */
		let set_prop = (property) => {
			if (settings.is_writable(property)) {
				// Set a new Background-Image (should show up immediately):
				if (!settings.set_string(property, path)) {
					this._bailOutWithCallback(`Failed to write property: ${property}`, callback);
				}
			} else {
				this._bailOutWithCallback(`Property not writable: ${property}`, callback);
			}
		}

		const availableKeys = settings.list_keys();

		let property = "picture-uri";
		if (availableKeys.indexOf(property) !== -1) {
			set_prop(property);
		}

		property = "picture-uri-dark";
		if (availableKeys.indexOf(property) !== -1) {
			set_prop(property);
		}

		Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140

		// call callback if given
		if (callback) {
			callback();
		}
	}

	setWallpaper(historyId) {
		let historyElement = this._historyController.get(historyId);

		if (this._historyController.promoteToActive(historyElement.id)) {
			this._setBackground(historyElement.path);
		} else {
			this.logger.warn("The history id (" + historyElement.id + ") could not be found.")
			// TODO: Error handling	history id not found.
		}
	}

	fetchNewWallpaper(callback) {
		this._startLoadingHooks.forEach((element) => {
			element();
		});

		if (!this._prohibitTimer) {
			this._timer.reset(); // reset timer
		}

		let returnObject = this._getRandomAdapter();
		returnObject.adapter.requestRandomImage((historyElement, error) => {
			if (historyElement == null || error) {
				this._bailOutWithCallback("Could not fetch wallpaper location.", callback);
				this._stopLoadingHooks.map(element => element(null));
				return;
			}

			this.logger.info("Requesting image: " + historyElement.source.imageDownloadUrl);

			returnObject.adapter.fetchFile(historyElement.source.imageDownloadUrl, (historyId, path, error) => {
				if (error) {
					this._bailOutWithCallback(`Could not load new wallpaper: ${error}`, callback);
					this._stopLoadingHooks.forEach(element => element(null));
					return;
				}

				historyElement.name = String(historyId);
				historyElement.id = `${historyElement.timestamp}_${historyElement.name}`; // timestamp ensures uniqueness
				historyElement.adapter.id = returnObject.adapterId;
				historyElement.adapter.type = returnObject.adapterType;

				// Move file to unique naming
				let sourceFile = Gio.File.new_for_path(path);
				let targetFolder = sourceFile.get_parent();
				let targetFile = targetFolder.get_child(historyElement.id);

				try {
					if (!sourceFile.move(targetFile, Gio.FileCopyFlags.NONE, null, null)) {
						this.logger.warn('Failed copying unique image.');
						return;
					}
				} catch (error) {
					if (error === Gio.IOErrorEnum.EXISTS) {
						this.logger.warn('Image already exists in location.');
						return;
					}
				}

				historyElement.path = targetFile.get_path();

				this._setBackground(historyElement.path, () => {
					// insert file into history
					this._historyController.insert(historyElement);

					this._stopLoadingHooks.forEach(element => element(null));

					// call callback if given
					if (callback) {
						callback();
					}
				});
			});
		});
	}

	// TODO: Change to original historyElement if more variable get exposed
	_getCommandArray(commandString, historyElementPath) {
		let string = commandString;
		if (string === "") {
			return null;
		}

		// Replace variables
		let variables = new Map();
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
			this.logger.warn(e);
		}

		return null;
	}

	_backgroundTimeout(delay) {
		if (this.timeout) {
			return;
		}

		delay = delay || 200;

		this.timeout = Mainloop.timeout_add(Mainloop.PRIORITY_DEFAULT, delay, () => {
			this.timeout = null;
			if (this._resetWallpaper) {
				this._setBackground(this._historyController.getCurrentElement().path);
				this._resetWallpaper = false;
			} else {
				this._setBackground(this.wallpaperLocation + this.previewId);
			}
			return false;
		});
	}

	previewWallpaper(historyid, delay) {
		if (!this._settings.get('disable-hover-preview', 'boolean')) {
			this.previewId = historyid;
			this._resetWallpaper = false;

			this._backgroundTimeout(delay);
		}
	}

	resetWallpaper() {
		if (!this._settings.get('disable-hover-preview', 'boolean')) {
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

	registerStartLoadingHook(fn) {
		if (typeof fn === "function") {
			this._startLoadingHooks.push(fn)
		}
	}

	registerStopLoadingHook(fn) {
		if (typeof fn === "function") {
			this._stopLoadingHooks.push(fn)
		}
	}

	_bailOutWithCallback(msg, callback) {
		this.logger.error(msg);

		if (callback) {
			callback();
		}
	}

};
