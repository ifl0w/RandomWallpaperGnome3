const Lang = imports.lang;
const Self = imports.misc.extensionUtils.getCurrentExtension();

// network requests
const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

const LoggerModule = Self.imports.logger;

let BaseAdapter = new Lang.Class({
	Name: "BaseAdapter",

	logge: null,

	_init: function () {
		this.logger = new LoggerModule.Logger('RWG3', 'BaseAdapter');
	},

	requestRandomImage: function () {
		this.logger.error("requestRandomImage not implemented")
	}
});

let DesktopperAdapter = new Lang.Class({
	Name: "DesktopperAdapter",
	Extends: BaseAdapter,
	/*
	 fetch a random image url from desktopper.cc
	 and call callback function with the URL of the image
	 */
	requestRandomImage: function (callback) {
		let session = new Soup.SessionAsync();
		let message = Soup.Message.new('GET', 'https://api.desktoppr.co/1/wallpapers/random');

		let parser = new Json.Parser();

		var _this = this;

		session.queue_message(message, function (session, message) {
			parser.load_from_data(message.response_body.data, -1);

			let data = parser.get_root().get_object();
			let response = data.get_object_member('response');
			let imageUrl = response.get_object_member('image').get_string_member('url');

			if (callback) {
				callback(imageUrl);
			}
		});
	}
});

let WallheavenAdapter = new Lang.Class({
	Name: "WallheavenAdapter",
	Extends: BaseAdapter,

	// query options
	options: {
		'q': '',
		'purity': '110', // SFW, sketchy
		'sorting': 'random',
		'category': '111', // General, Anime, People
		'resolutions': ['1920x1200', '2560x1440']
	},

	/*
	 fetch a random image url from wallheaven.cc with the given options
	 and call callback function with the URL of the image
	 */
	requestRandomImage: function (callback) {
		let session = new Soup.SessionAsync();

		let options = this.options;
		let optionsString = "";

		for (var key in options) {
			if (options.hasOwnProperty(key)) {
				if (Array.isArray(options[key])) {
					optionsString += key + "=" + options[key].join() + "&";
				} else {
					optionsString += key + "=" + options[key] + "&";
				}
			}
		}
		// remove last '&'
		optionsString = optionsString.slice(0, -1);

		let url = 'http://alpha.wallhaven.cc/search?' + optionsString;

		let message = Soup.Message.new('GET', url);

		var _this = this;

		session.queue_message(message, function (session, message) {
			let body = message.response_body.data;
			let urlArray = body.match(new RegExp(/http[s]*:\/\/alpha.wallhaven.cc\/wallpaper\/[0-9]+/g));

			// remove dublicates from array
			let uniqueUrlArray = urlArray.filter(function (item, pos) {
				return urlArray.indexOf(item) == pos;
			});

			// get a random entry from the array
			var url = uniqueUrlArray[Math.floor(Math.random() * uniqueUrlArray.length)];

			message = Soup.Message.new('GET', url);

			session.queue_message(message, function () {
				let body = message.response_body.data;
				let imageUrl = body.match(new RegExp(/\/\/wallpapers.wallhaven.cc\/wallpapers\/full\/.*?"/))[0];
				imageUrl = imageUrl.slice(0, -1);
				imageUrl = 'http:' + imageUrl;

				if (callback) {
					callback(imageUrl);
				}
			})


		});
	}
});
