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

let WallpaperController = new Lang.Class({
	Name: "WallpaperController",
	extensionMeta: null,

	wallpaperlocation: '',
	currentWallpaper: '',
	historySize: 10,
	history: [],
	imageSourceAdapter: undefined,

	autoFetch : {
		active: false,
		duration: 30,
	},

	_init: function(extensionMeta){
		this.extensionMeta = extensionMeta;
		this.wallpaperlocation = this.extensionMeta.path + '/wallpapers/';

		this._settings = Convenience.getSettings();
		this._settings.connect('changed', this._loadSettings.bind(this));
		this._loadSettings();

		this.history = this._loadHistory();
		this.currentWallpaper = this._getCurrentWallpaper();

		this.imageSourceAdapter = new SourceAdapter.DesktopperAdapter();
		this.imageSourceAdapter = new SourceAdapter.WallheavenAdapter();

		if (this.autoFetch.active) {

		}
	},

	_loadSettings: function() {
		this.historySize = this._settings.get_int('history-length');
		this.autoFetch.active = this._settings.get_boolean('auto-fetch');

		let duration = 0;
		duration += this._settings.get_int('minutes');
		duration += this._settings.get_int('hours') * 60;
		this.autoFetch.duration = duration;
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
		this.historySize = this._settings.get_int('history-length');
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
		let _this = this;
		this._requestRandomImageFromAdapter(function(imageUrl){
			_this._fetchFile(imageUrl, function(historyid, path) {
				// insert file into history
				_this.history.unshift(historyid);

				_this._setBackground(_this.wallpaperlocation + historyid, function(){
					// call callback if given
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
	}

});
