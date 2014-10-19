const Lang = imports.lang;

// network requests
const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

// Filesystem
const Gio = imports.gi.Gio;

let WallpaperController = new Lang.Class({
	Name: "WallpaperController",
	extensionMeta: null,

	wallpaperlocation: '',
	historySize: 5,

	_init: function(extensionMeta){
		this.extensionMeta = extensionMeta;
		this.wallpaperlocation = this.extensionMeta.path + '/wallpapers/';
	},


	// fetch a random image url from desktopper.cc
	_requestRandomImage: function(){
		let session = new Soup.SessionAsync();
		let message = Soup.Message.new('GET', 'https://api.desktoppr.co/1/wallpapers/random')

		let parser = new Json.Parser();

		var _this = this;

		session.queue_message(message, function(session, message) {
			parser.load_from_data(message.response_body.data, -1);

			let data = parser.get_root().get_object()
			let response = data.get_object_member('response');
			let imageUrl = response.get_object_member('image').get_string_member('url');

			_this._writeToFile(imageUrl);
		});
	},

	// copy file from uri to local direcotry
	_writeToFile: function(uri){
		let date = new Date();
		let inputbuffer;

		//extract the name from the desktopper url and add timestamp prefix
		let name = date.getTime() + uri.substr(uri.lastIndexOf('.'));
		
		global.log(uri);
		global.log(this.wallpaperlocation + String(name));

		let output_file = Gio.file_new_for_path(this.wallpaperlocation + String(name));
		let output_stream = output_file.create(0, null);

		let input_file = Gio.file_new_for_uri(uri);

		let _this = this;

		input_file.load_contents_async(null, function(file, result){
			let contents = file.load_contents_finish(result)[1];
			output_stream.write(contents, null);
			_this._setBackground(output_file.get_path());
		});

		/*let fstream = input_file.copy(output_file, Gio.FileCopyFlags.OVERWRITE, null, function(){
		}, function(){
		});  */
	},


	_setBackground: function(path){
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});

		global.log("Current Background-Image: "+ background_setting.get_string("picture-uri"));
		
		// Set:
		if (background_setting.is_writable("picture-uri")){
			// Set a new Background-Image (should show up immediately):
			if (background_setting.set_string("picture-uri", "file://"+path) ){
				//background_setting.apply();
				Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140
			} else {
				global.log("FAAILLEEDD");
			}
		} else {
			global.log("FAAILLEEDD");
		}

		this.deleteOldPictures();
	},

	getHistory: function () {
		let directory = Gio.file_new_for_path(this.wallpaperlocation);
		let enumerator = directory.enumerate_children('', Gio.FileQueryInfoFlags.NONE, null);
		let fileinfo;
		let history = [];

		do {
			fileinfo = enumerator.next_file(null);

			if (!fileinfo) {
				global.log("SHOUT!!!");
				break;
			};

			let name = fileinfo.get_name();
			
			// ignore hidden files
			if (name[0] != '.') {
				history.push(fileinfo.get_name());
			};

		} while(fileinfo);

		history.sort();

		global.log(history);
		return history;
	},

	deleteOldPictures: function() {
		let history = this.getHistory();
		let deleteFile;

		while(history.length > this.historySize) {
			deleteFile = Gio.file_new_for_path(this.wallpaperlocation + history.shift());
			deleteFile.delete(null);
		}
	}
});