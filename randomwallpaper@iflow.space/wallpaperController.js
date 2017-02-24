const Lang = imports.lang;
const Mainloop = imports.gi.GLib;

// network requests
const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

// Filesystem
const Gio = imports.gi.Gio;

//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const SourceAdapter = Self.imports.sourceAdapter;
const Convenience = Self.imports.convenience;
const Prefs = Self.imports.settings;
const Timer = Self.imports.timer;

let WallpaperController = new Lang.Class({
	Name: "WallpaperController",
	extensionMeta: null,

	wallpaperlocation: '',
	currentWallpaper: '',
	historySize: 10,
	history: [],
	imageSourceAdapter: undefined,

	_timer: null,
	_autoFetch : {
		active: false,
		duration: 30,
	},

	// functions will be called uppon loading a new wallpaper
	_startLoadingHooks: [],
	// functions will be called when loading a new wallpaper stopped. If an error occured then the error will be passed as parameter.
	_stopLoadingHooks: [],

	_init: function(extensionMeta){
		this.extensionMeta = extensionMeta;
		this.wallpaperlocation = this.extensionMeta.path + '/wallpapers/';

		this._timer = new Timer.AFTimer();

		this._settings = new Prefs.Settings();
		this._settings.observe('history-length', this._updateHistory.bind(this));
		this._settings.observe('auto-fetch', this._updateAutoFetching.bind(this));
		this._settings.observe('minutes', this._updateAutoFetching.bind(this));
		this._settings.observe('hours', this._updateAutoFetching.bind(this));

		this._updateHistory();
		this._updateAutoFetching();

		this.history = this._loadHistory();
		this.currentWallpaper = this._getCurrentWallpaper();

		this.imageSourceAdapter = new SourceAdapter.DesktopperAdapter();
		this.imageSourceAdapter = new SourceAdapter.WallheavenAdapter();
	},

	_updateHistory: function() {
		this.historySize = this._settings.get('history-length', 'int');
	},

	_updateAutoFetching: function() {
		let duration = 0;
		duration += this._settings.get('minutes', 'int');
		duration += this._settings.get('hours', 'int') * 60;
		this._autoFetch.duration = duration;
		this._autoFetch.active = this._settings.get('auto-fetch', 'boolean');

		if (this._autoFetch.active) {
			this._timer.registerCallback(this.fetchNewWallpaper.bind(this));
			this._timer.begin();
		} else {
			this._timer.end();
		}
	},

	/*
		forwards the request to the adapter
	*/
	_requestRandomImageFromAdapter: function(callback){
		this.imageSourceAdapter.requestRandomImage(callback);
	},

	/*
		copy file from uri to local wallpaper direcotry	and calls
		the given callback with the name and the full filepath of
		the written file as parameter.
	*/
	_fetchFile: function(uri, callback){
		let date = new Date();
		let inputbuffer;

		//extract the name from the desktopper url and add timestamp prefix
		let name = date.getTime() + uri.substr(uri.lastIndexOf('.'));

		let output_file = Gio.file_new_for_path(this.wallpaperlocation + String(name));
		let output_stream = output_file.create(0, null);

		let input_file = Gio.file_new_for_uri(uri);

		let _this = this;

		input_file.load_contents_async(null, function(file, result){
			let contents = file.load_contents_finish(result)[1];
			output_stream.write(contents, null);

			// call callback with the name and the full filepath of the written file as parameter
			if (callback) {
				callback(name, output_file.get_path());
			};
		});
	},

	/*
		Set a new timestamp as name for the given file
		and adapt the history
	*/
	_setNewFileName: function(historyid) {
		let date = new Date();
		let file = Gio.file_new_for_path(this.wallpaperlocation + historyid);
		let name = date.getTime() + historyid.substr(historyid.lastIndexOf('.'));
		let newFile = Gio.file_new_for_path(this.wallpaperlocation + name);

		for (var i = 0; i < this.history.length; i++) {
			if(this.history[i] == historyid) {
				file.move(newFile, Gio.FileCopyFlags.NONE, null, function(){
				});

				// TODO: error handling, what if move fails?

				this.history[i] = name;

				this.history.sort();
				this.history.reverse();

				return name;
			}
		};

		return false;
	},

	_setBackground: function(path, callback){
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
		this.deleteOldPictures();

		/*
			inspired from:
			https://bitbucket.org/LukasKnuth/backslide/src/7e36a49fc5e1439fa9ed21e39b09b61eca8df41a/backslide@codeisland.org/settings.js?at=master
		*/
		// Set:
		if (background_setting.is_writable("picture-uri")){
			// Set a new Background-Image (should show up immediately):
			if (background_setting.set_string("picture-uri", "file://"+path) ){
				Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140
				// call callback if given
				if (callback) {
					callback();
				};
			} else {
				// TODO: error handling
			}
		} else {
			// TODO: error handling
		}

	},

	_getCurrentWallpaper: function() {
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
		return background_setting.get_string("picture-uri").replace(/^(file:\/\/)/, "");
	},

	_loadHistory: function () {
		let directory = Gio.file_new_for_path(this.wallpaperlocation);
		let enumerator = directory.enumerate_children('', Gio.FileQueryInfoFlags.NONE, null);

		let fileinfo;
		let history = [];

		do {
			fileinfo = enumerator.next_file(null);

			if (!fileinfo) {
				break;
			};

			let name = fileinfo.get_name();

			// ignore hidden files
			if (name[0] != '.') {
				history.push(fileinfo.get_name());
			};

		} while(fileinfo);

		history.sort();
		history.reverse();

		return history;
	},

	deleteOldPictures: function() {
		this.historySize = this._settings.get('history-length', 'int');
		let deleteFile;
		while(this.history.length > this.historySize) {
			deleteFile = Gio.file_new_for_path(this.wallpaperlocation + this.history.pop());
			deleteFile.delete(null);
		}
	},

	setWallpaper: function(historyEntry, keepName) {
		if (!keepName) {
			historyEntry = this._setNewFileName(historyEntry);
		}
		this._setBackground(this.wallpaperlocation + historyEntry);
		this.currentWallpaper = this._getCurrentWallpaper();
	},

	fetchNewWallpaper: function(callback) {
		this._startLoadingHooks.forEach((element) => {
			element();
		});
		this._timer.begin(); // reset timer

		let _this = this;
		this._requestRandomImageFromAdapter(function(imageUrl){
			_this._fetchFile(imageUrl, function(historyid, path) {
				// insert file into history
				_this.history.unshift(historyid);

				_this._setBackground(_this.wallpaperlocation + historyid, function(){
					// call callback if given
					_this._stopLoadingHooks.forEach((element) => {
						element(null);
					});
					if (callback) {
						callback();
					};
				});
			});
		});
	},

	_backgroundTimout: function(delay) {
		if (this.timeout) {
			return;
		};

		let _this = this;
		delay = delay || 200;

		this.timeout = Mainloop.timeout_add(Mainloop.PRIORITY_DEFAULT, delay, function(){
			_this.timeout = null;
			if (_this._resetWallpaper) {
				_this._setBackground(_this.currentWallpaper);
				_this._resetWallpaper = false;
			} else {
				_this._setBackground(_this.wallpaperlocation + _this.previewId);
			}
			return false;
		});
	},

	previewWallpaper: function(historyid, delay) {
		this.previewId = historyid;
		this._resetWallpaper = false;

		this._backgroundTimout(delay);
	},

	resetWallpaper: function() {
		this._resetWallpaper = true;
		this._backgroundTimout();
	},

	getHistory: function() {
		return this.history;
	},

	deleteHistory: function() {
		let firstHistoryElement = this.history[0];

		if (firstHistoryElement)
			this.history = [firstHistoryElement];

		let directory = Gio.file_new_for_path(this.wallpaperlocation);
		let enumerator = directory.enumerate_children('', Gio.FileQueryInfoFlags.NONE, null);

		let fileinfo;
		let deleteFile;

		do {

			fileinfo = enumerator.next_file(null);

			if (!fileinfo) {
				break;
			};

			let name = fileinfo.get_name();

			// ignore hidden files and first element
			if (name[0] != '.' && name != firstHistoryElement) {
				deleteFile = Gio.file_new_for_path(this.wallpaperlocation + name);
				deleteFile.delete(null);
			};

		} while(fileinfo);

		return true;
	},

	menuShowHook: function() {
		this.currentWallpaper = this._getCurrentWallpaper();
	},

	registerStartLoadingHook: function(fn) {
		if (typeof fn === "function") {
			this._startLoadingHooks.push(fn)
		}
	},

	registerStopLoadingHook: function(fn) {
		if (typeof fn === "function") {
			this._stopLoadingHooks.push(fn)
		}
	}
});
