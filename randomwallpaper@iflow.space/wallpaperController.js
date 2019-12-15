const Mainloop = imports.gi.GLib;

// Filesystem
const Gio = imports.gi.Gio;

// HTTP
const Soup = imports.gi.Soup;
const Lang = imports.lang;

//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const SourceAdapter = Self.imports.sourceAdapter;
const Prefs = Self.imports.settings;
const Timer = Self.imports.timer;
const HistoryModule = Self.imports.history;

const LoggerModule = Self.imports.logger;

var WallpaperController = class {

	constructor() {
		this.logger = new LoggerModule.Logger('RWG3', 'WallpaperController');
		this.wallpaperlocation = Self.path + '/wallpapers/';
		this.imageSourceAdapter = null;

		this._autoFetch = {
			active: false,
			duration: 30,
		};

		// functions will be called uppon loading a new wallpaper
		this._startLoadingHooks = [];
		// functions will be called when loading a new wallpaper stopped. If an error occured then the error will be passed as parameter.
		this._stopLoadingHooks = [];

		this._timer = new Timer.AFTimer();
		this._historyController = new HistoryModule.HistoryController(this.wallpaperlocation);

		this._settings = new Prefs.Settings();
		this._settings.observe('history-length', this._updateHistory.bind(this));
		this._settings.observe('auto-fetch', this._updateAutoFetching.bind(this));
		this._settings.observe('minutes', this._updateAutoFetching.bind(this));
		this._settings.observe('hours', this._updateAutoFetching.bind(this));

		this._desktopperAdapter = new SourceAdapter.DesktopperAdapter();
		this._unsplashAdapter = new SourceAdapter.UnsplashAdapter();
		this._wallhavenAdapter = new SourceAdapter.WallhavenAdapter();
		this._redditAdapter = new SourceAdapter.RedditAdapter();
		this._genericJsonAdapter = new SourceAdapter.GenericJsonAdapter();

		this._updateHistory();
		this._updateAutoFetching();

		this.currentWallpaper = this._getCurrentWallpaper();
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

		if (this._autoFetch.active) {
			this._timer.registerCallback(this.fetchNewWallpaper.bind(this));
			this._timer.setMinutes(this._autoFetch.duration);
			this._timer.start();
		} else {
			this._timer.stop();
		}
	}

	/*
	 forwards the request to the adapter
	 */
	_requestRandomImageFromAdapter(callback) {
		this.imageSourceAdapter = this._desktopperAdapter;
		switch (this._settings.get('source', 'enum')) {
			case 0:
				this.imageSourceAdapter = this._unsplashAdapter;
				break;
			case 1:
				this.imageSourceAdapter = this._desktopperAdapter;
				break;
			case 2:
				this.imageSourceAdapter = this._wallhavenAdapter;
				break;
			case 3:
				this.imageSourceAdapter = this._redditAdapter;
				break;
			case 4:
				this.imageSourceAdapter = this._genericJsonAdapter;
				break;
			default:
				this.imageSourceAdapter = this._desktopperAdapter;
				break;
		}

		this.imageSourceAdapter.requestRandomImage(callback);
	}

	/**
	 * copy file from uri to local wallpaper directory and calls the given callback with the name and the full filepath
	 * of the written file as parameter.
	 * @param uri
	 * @param callback(name, path, error)
	 * @private
	 */
	_fetchFile(uri, callback) {
		//extract the name from the url and
		let date = new Date();
		let name = date.getTime() + '_' + this.imageSourceAdapter.fileName(uri); // timestamp ensures uniqueness

		let output_file, output_stream, input_file;

		let _httpSession = new Soup.SessionAsync();
		Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

		let file = Gio.file_new_for_path(this.wallpaperlocation + String(name));
		let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

		// start the download
		let request = Soup.Message.new('GET', uri);
		request.connect('got_chunk', Lang.bind(this, function(message, chunk){
			try {
				fstream.write(chunk.get_data(), null);
			} catch (e) {
				if (callback) {
					callback(null, null, e);
				}
				return;
			}
		}));

		_httpSession.queue_message(request, function(_httpSession, message) {
			// close the file
			fstream.close(null);
			// call callback with the name and the full filepath of the written file as parameter
			if (callback) {
				callback(name, file.get_path());
			}
		});
	}

	/**
	 * Sets the wallpaper and the lockscreen when enabled to the given path. Executes the callback on success.
	 * @param path
	 * @param callback
	 * @private
	 */
	_setBackground(path, callback) {
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
		path = "file://" + path;

		this._setPictureUriOfSettingsObject(background_setting, path, () => {
			if (this._settings.get('change-lock-screen', 'boolean')) {
				let screensaver_setting = new Gio.Settings({schema: "org.gnome.desktop.screensaver"});

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
		if (settings.is_writable("picture-uri")) {
			// Set a new Background-Image (should show up immediately):
			let rc = settings.set_string("picture-uri", path);
			if (rc) {
				Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140

				// call callback if given
				if (callback) {
					callback();
				}

			} else {
				this._bailOutWithCallback("Could not set lock screen wallpaper.", callback);
			}
		} else {
			this._bailOutWithCallback("Could not set wallpaper.", callback);
		}
	}

	_getCurrentWallpaper() {
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
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

		this._timer.reset(); // reset timer

		this._requestRandomImageFromAdapter((historyElement, error) => {
			if (historyElement == null || error) {
				this._bailOutWithCallback("Could not fetch wallpaper location.", callback);
				this._stopLoadingHooks.map(element => element(null));
				return;
			}

			this.logger.info("Requesting image: " + historyElement.source.imageDownloadUrl);

			this._fetchFile(historyElement.source.imageDownloadUrl, (historyId, path, error) => {
				if (error) {
					this._bailOutWithCallback("Could not load new wallpaper. (" + error + ")", callback);
					this._stopLoadingHooks.map(element => element(null));
					return;
				}

				historyElement.path = path;
				historyElement.id = historyId;

				this._setBackground(path, () => {
					// insert file into history
					this._historyController.insert(historyElement);
					this.currentWallpaper = this._getCurrentWallpaper();

					this._stopLoadingHooks.map(element => element(null));

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
