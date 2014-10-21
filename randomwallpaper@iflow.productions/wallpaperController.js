const Lang = imports.lang;
const Mainloop = imports.gi.GLib;

// network requests
const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

// Filesystem
const Gio = imports.gi.Gio;

let WallpaperController = new Lang.Class({
	Name: "WallpaperController",
	extensionMeta: null,

	wallpaperlocation: '',
	currentWallpaper: '',
	historySize: 10,
	history: [],

	_init: function(extensionMeta){
		this.extensionMeta = extensionMeta;
		this.wallpaperlocation = this.extensionMeta.path + '/wallpapers/';
		this.history = this._loadHistory();
		this.currentWallpaper = this._getCurrentWallpaper();
	},


	/* 
		fetch a random image url from desktopper.cc
		and call callback function with the URL of the image
	*/
	_requestRandomImageDesktopper: function(callback){
		let session = new Soup.SessionAsync();
		let message = Soup.Message.new('GET', 'https://api.desktoppr.co/1/wallpapers/random')

		let parser = new Json.Parser();

		var _this = this;

		session.queue_message(message, function(session, message) {
			parser.load_from_data(message.response_body.data, -1);

			let data = parser.get_root().get_object()
			let response = data.get_object_member('response');
			let imageUrl = response.get_object_member('image').get_string_member('url');

			if (callback) {
				callback(imageUrl);
			};
		});
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

				this.history[i] = name;

				this.history.sort();
				this.history.reverse();

				return name;
			}
		};

		return false;
	},

	_setBackground: function(path){
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
	
		/*
			inspired from:
			https://bitbucket.org/LukasKnuth/backslide/src/7e36a49fc5e1439fa9ed21e39b09b61eca8df41a/backslide@codeisland.org/settings.js?at=master
		*/
		// Set:
		if (background_setting.is_writable("picture-uri")){
			// Set a new Background-Image (should show up immediately):
			if (background_setting.set_string("picture-uri", "file://"+path) ){
				Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140
			} else {
				global.log("FAAILLEEDD");
			}
		} else {
			global.log("FAAILLEEDD");
		}

		this.deleteOldPictures();
	},

	_getCurrentWallpaper: function() {
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
		return background_setting.get_string("picture-uri");
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
		let deleteFile;
		while(this.history.length > this.historySize) {
			deleteFile = Gio.file_new_for_path(this.wallpaperlocation + this.history.pop());
			deleteFile.delete(null);
		}
	},

	setWallpaper: function(historyEntry) {
		historyEntry = this._setNewFileName(historyEntry);
		this._setBackground(this.wallpaperlocation + historyEntry);
	},

	fetchNewWallpaper: function(callback) {
		let _this = this;

		this._requestRandomImageDesktopper(function(imageUrl){
			_this._fetchFile(imageUrl, function(historyid, path) {
				// insert file into history
				_this.history.unshift(historyid);

				_this._setBackground(_this.wallpaperlocation + historyid);

				// call callback if given
				if (callback) {
					callback();
				};
			});
		});
	},

	previewWallpaper: function(historyid) {
		this.previewId = historyid;
		let _this = this;

		if (_this.timeout) {
			return;
		};

		this.timeout = Mainloop.timeout_add(Mainloop.PRIORITY_DEFAULT, 250, function(){
			_this.timeout = null;
			_this._setBackground(_this.wallpaperlocation + _this.previewId);
			return false;
		});
	},

	resetWallpaper: function() {
	},

	getHistory: function() {
		return this.history;
	}

});