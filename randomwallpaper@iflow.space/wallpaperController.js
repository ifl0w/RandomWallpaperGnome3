const Mainloop = imports.gi.GLib;

// Filesystem
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const SourceAdapter = Self.imports.sourceAdapter;
const Prefs = Self.imports.settings;
const Timer = Self.imports.timer;
const HistoryModule = Self.imports.history;

const LoggerModule = Self.imports.logger;

const RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.backend-connection';

var WallpaperController = class {
	_backendConnection = null;
	_prohibitTimer = false;

	constructor() {
		this.logger = new LoggerModule.Logger('RWG3', 'WallpaperController');
		let xdg_cache_home = Mainloop.getenv('XDG_CACHE_HOME')
		if (!xdg_cache_home) {
			xdg_cache_home = `${Mainloop.getenv('HOME')}/.cache`
		}
		this.wallpaperlocation = `${xdg_cache_home}/${Self.metadata['uuid']}/wallpapers/`;
		let mode = parseInt('0755', 8);
		Mainloop.mkdir_with_parents(this.wallpaperlocation, mode)

		this._autoFetch = {
			active: false,
			duration: 30,
		};

		// functions will be called upon loading a new wallpaper
		this._startLoadingHooks = [];
		// functions will be called when loading a new wallpaper stopped. If an error occurred then the error will be passed as parameter.
		this._stopLoadingHooks = [];

		this._backendConnection = new Prefs.Settings(RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);

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
		this._historyController = new HistoryModule.HistoryController(this.wallpaperlocation);

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

		this.currentWallpaper = this._getCurrentWallpaper();
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
			let uri = GLib.filename_to_uri(this.wallpaperlocation, "");
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

		let source = this._getRandomSource();

		switch (source.type) {
			case 0:
				imageSourceAdapter = new SourceAdapter.UnsplashAdapter(source.id);
				break;
			case 1:
				imageSourceAdapter = new SourceAdapter.WallhavenAdapter(source.id);
				break;
			case 2:
				imageSourceAdapter = new SourceAdapter.RedditAdapter(source.id);
				break;
			case 3:
				imageSourceAdapter = new SourceAdapter.GenericJsonAdapter(source.id);
				break;
			default:
				imageSourceAdapter = new SourceAdapter.UnsplashAdapter(null);
				// TODO: log error and abort, raise exception?
				break;
		}

		return imageSourceAdapter;
	}

	_getRandomSource() {
		let stringSources = this._settings.get('sources', 'strv');
		let sources = stringSources.map(elem => {
			return JSON.parse(elem)
		});

		if (sources === null || sources.length < 1) {
			return { type: -1 };
		}

		let enabled_sources = sources.filter(element => { return element.enabled; })

		if (enabled_sources === null || enabled_sources.length < 1) {
			return { type: -1 };
		}

		// https://stackoverflow.com/a/5915122
		return enabled_sources[Math.floor(Math.random() * enabled_sources.length)];
	}

	/**
	 * Sets the wallpaper and the lockscreen when enabled to the given path. Executes the callback on success.
	 * @param path
	 * @param callback
	 * @private
	 */
	_setBackground(path, callback) {
		let background_setting = new Gio.Settings({ schema: "org.gnome.desktop.background" });
		path = "file://" + path;

		this._setPictureUriOfSettingsObject(background_setting, path, () => {
			if (this._settings.get('change-lock-screen', 'boolean')) {
				let screensaver_setting = new Gio.Settings({ schema: "org.gnome.desktop.screensaver" });

				this._setPictureUriOfSettingsObject(screensaver_setting, path, () => {
					// call callback if given
					if (callback) {
						callback();
					}
				});
			} else {
				// call callback if given
				if (callback) {
					callback();
				}
			}
		});
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

	_getCurrentWallpaper() {
		let background_setting = new Gio.Settings({ schema: "org.gnome.desktop.background" });
		return background_setting.get_string("picture-uri").replace(/^(file:\/\/)/, "");
	}

	setWallpaper(historyId) {
		let historyElement = this._historyController.get(historyId);

		if (this._historyController.promoteToActive(historyElement.id)) {
			this._setBackground(historyElement.path);
			this.currentWallpaper = this._getCurrentWallpaper();
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

		let adapter = this._getRandomAdapter();
		adapter.requestRandomImage((historyElement, error) => {
			if (historyElement == null || error) {
				this._bailOutWithCallback("Could not fetch wallpaper location.", callback);
				this._stopLoadingHooks.map(element => element(null));
				return;
			}

			this.logger.info("Requesting image: " + historyElement.source.imageDownloadUrl);

			adapter.fetchFile(historyElement.source.imageDownloadUrl, (historyId, path, error) => {
				if (error) {
					this._bailOutWithCallback(`Could not load new wallpaper: ${error}`, callback);
					this._stopLoadingHooks.forEach(element => element(null));
					return;
				}

				historyElement.path = path;
				historyElement.id = historyId;

				this._setBackground(path, () => {
					// insert file into history
					this._historyController.insert(historyElement);
					this.currentWallpaper = this._getCurrentWallpaper();

					this._stopLoadingHooks.forEach(element => element(null));

					// call callback if given
					if (callback) {
						callback();
					}
				});
			});
		});
	}

	_backgroundTimeout(delay) {
		if (this.timeout) {
			return;
		}

		delay = delay || 200;

		this.timeout = Mainloop.timeout_add(Mainloop.PRIORITY_DEFAULT, delay, () => {
			this.timeout = null;
			if (this._resetWallpaper) {
				this._setBackground(this.currentWallpaper);
				this._resetWallpaper = false;
			} else {
				this._setBackground(this.wallpaperlocation + this.previewId);
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
		this.currentWallpaper = this._getCurrentWallpaper();
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
