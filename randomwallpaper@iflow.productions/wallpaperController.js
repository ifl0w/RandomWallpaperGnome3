const Lang = imports.lang;

// network requests
const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

// Filesystem
const Gio = imports.gi.Gio;

let WallpaperController = new Lang.Class({
	Name: "WallpaperController",
	extensionMeta: null,

	_init: function(extensionMeta){
		this.extensionMeta = extensionMeta;
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

		let output_file = Gio.file_new_for_path(this.extensionMeta.path + '/wallpapers/' + String(date.getTime()));
		let output_stream = output_file.create(0, null);

		let input_file = Gio.file_new_for_uri(uri);
		let input_stream = input_file.read(null);


		let fstream = input_file.copy(output_file, Gio.FileCopyFlags.OVERWRITE, null, function(){
		}, function(){
		});  

		global.log('========================');
		global.log(output_file.get_path());
		global.log('========================');
		this._setBackground(output_file.get_path());
	},


	_setBackground: function(path){
		let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});

		global.log("Current Background-Image: "+ background_setting.get_string("picture-uri"));
		
		// Set:
		if (background_setting.is_writable("picture-uri")){
			// Set a new Background-Image (should show up immediately):
			if (background_setting.set_string("picture-uri", "file://"+path) ){
				Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140
				background_setting.apply();
			} else {
				global.log("FAAILLEEDD");
			}
		} else {
			global.log("FAAILLEEDD");
		}
		background_setting.apply();
	}
});