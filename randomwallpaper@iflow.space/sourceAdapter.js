const Lang = imports.lang;
const Self = imports.misc.extensionUtils.getCurrentExtension();

// network requests
const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

const HistoryModule = Self.imports.history;

const LoggerModule = Self.imports.logger;

let BaseAdapter = new Lang.Class({
	Name: "BaseAdapter",
	logger: null,


	_init: function () {
		this.logger = new LoggerModule.Logger('RWG3', 'BaseAdapter');
	},

	/**
	 * Retrieves a new url for an image and calls the given callback with an HistoryEntry as parameter.
	 * @param callback
	 */
	requestRandomImage: function (callback) {
		this.logger.error("requestRandomImage not implemented");

		callback(null);
	},

	fileName: function(uri)
	{
		let base = new String(uri).substring(uri.lastIndexOf('/') + 1);
		return base;
	},

});

let DesktopperAdapter = new Lang.Class({
	Name: "DesktopperAdapter",
	Extends: BaseAdapter,

	requestRandomImage: function (callback) {
		let session = new Soup.SessionAsync();
		let message = Soup.Message.new('GET', 'https://api.desktoppr.co/1/wallpapers/random');

		let parser = new Json.Parser();

		session.queue_message(message, (session, message) => {
			parser.load_from_data(message.response_body.data, -1);

			let data = parser.get_root().get_object();
			let response = data.get_object_member('response');
			let imageUrl = response.get_object_member('image').get_string_member('url');

			if (callback) {
				let historyEntry = new HistoryModule.HistoryEntry(null, 'desktopper.co', imageUrl);
				historyEntry.source.sourceUrl = 'https://www.desktoppr.co/';
				callback(historyEntry);
			}
		});
	}
});

let UnsplashAdapter = new Lang.Class({
	Name: "UnsplashAdapter",
	Extends: BaseAdapter,

	sourceName: 'Unsplash',
	sourceUrl: 'https://unsplash.com/',

	requestRandomImage: function (callback) {
		let session = new Soup.SessionAsync();
		let url = 'https://api.unsplash.com/photos/random';
		url += '?client_id=64daf439e9b579dd566620c0b07022706522d87b255d06dd01d5470b7f193b8d';
		let message = Soup.Message.new('GET', url);

		let utmParameters = '?utm_source=RandomWallpaperGnome3&utm_medium=referral&utm_campaign=api-credit';

		session.queue_message(message, (session, message) => {
			let data = JSON.parse(message.response_body.data);

			let imageUrl = data.links.download;
			let authorName = data.user.name;
			let authorUrl = data.user.links.html;

			this.logger.debug(authorName);
			this.logger.debug(authorUrl);

			if (callback) {
				let historyEntry = new HistoryModule.HistoryEntry(authorName, this.sourceName, imageUrl+utmParameters);
				historyEntry.source.sourceUrl = this.sourceUrl+utmParameters;
				historyEntry.source.authorUrl = authorUrl+utmParameters;
				callback(historyEntry);
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

		for (let key in options) {
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

		session.queue_message(message, (session, message) => {
			let body = message.response_body.data;
			let urlArray = body.match(new RegExp(/http[s]*:\/\/alpha.wallhaven.cc\/wallpaper\/[0-9]+/g));

			// remove dublicates from array
			let uniqueUrlArray = urlArray.filter(function (item, pos) {
				return urlArray.indexOf(item) == pos;
			});

			// get a random entry from the array
			let url = uniqueUrlArray[Math.floor(Math.random() * uniqueUrlArray.length)];

			message = Soup.Message.new('GET', url);

			session.queue_message(message, () => {
				let body = message.response_body.data;
				let imageUrl = body.match(new RegExp(/\/\/wallpapers.wallhaven.cc\/wallpapers\/full\/.*?"/))[0];
				imageUrl = imageUrl.slice(0, -1);
				imageUrl = 'http:' + imageUrl;

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(null, 'wallhaven.cc', imageUrl);
					historyEntry.source.sourceUrl = 'https://alpha.wallhaven.cc/';
					callback(historyEntry);
				}
			})


		});
	}
});
