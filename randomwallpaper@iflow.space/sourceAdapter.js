const Lang = imports.lang;
const Self = imports.misc.extensionUtils.getCurrentExtension();

// network requests
const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

const RWG_SETTINGS_SCHEMA_DESKTOPPER = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.desktopper';
const RWG_SETTINGS_SCHEMA_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.unsplash';
const RWG_SETTINGS_SCHEMA_WALLHEAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.wallheaven';
const RWG_SETTINGS_SCHEMA_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.genericJSON';

const SettingsModule = Self.imports.settings;
const HistoryModule = Self.imports.history;

const LoggerModule = Self.imports.logger;
const JSONPath = Self.imports.jsonpath.jsonpath;

var BaseAdapter = new Lang.Class({
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

	fileName: function (uri) {
		let base = decodeURIComponent(uri);
		base = base.substring(base.lastIndexOf('/') + 1);
		if (base.indexOf('?') >= 0) {
			base = base.substr(0, base.indexOf('?'));
		}
		return base;
	},

});

var DesktopperAdapter = new Lang.Class({
	Name: "DesktopperAdapter",
	Extends: BaseAdapter,

	_settings: null,

	_init: function () {
		this.parent();

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_DESKTOPPER);
	},

	requestRandomImage: function (callback) {
		let session = new Soup.SessionAsync();

		let url = 'https://api.desktoppr.co/1/wallpapers/random';
		let allowUnsafe = this._settings.get('allow-unsafe', 'boolean');
		if (allowUnsafe) {
			url += '?safe_filter=all';
		} else {
			url += '?safe_filter=safe';
		}
		url = encodeURI(url);

		let message = Soup.Message.new('GET', url);

		session.queue_message(message, (session, message) => {
			let data = JSON.parse(message.response_body.data);
			let response = data.response;
			let imageUrl = encodeURI(response.image.url);

			if (callback) {
				let historyEntry = new HistoryModule.HistoryEntry(null, 'desktopper.co', imageUrl);
				historyEntry.source.sourceUrl = 'https://www.desktoppr.co/';
				callback(historyEntry);
			}
		});
	}
});

var UnsplashAdapter = new Lang.Class({
	Name: "UnsplashAdapter",
	Extends: BaseAdapter,

	sourceName: 'Unsplash',
	sourceUrl: 'https://unsplash.com/',

	_settings: null,

	// query options
	options: {
		'username': '',
		'query': '',
		'w': 1920,
		'h': 1080,
		'featured': false
	},

	_init: function () {
		this.parent();

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_UNSPLASH);
	},

	requestRandomImage: function (callback) {
		let session = new Soup.SessionAsync();

		this._readOptionsFromSettings();
		let optionsString = this._generateOptionsString();
		let clientParam = 'client_id=2e4e49adee7dcaf75515d383086909e1ed5f0b08db60becf8ec58bc63cbc418a';

		let url = 'https://api.unsplash.com/photos/random?' + optionsString + clientParam;
		url = encodeURI(url);

		let message = Soup.Message.new('GET', url);

		let utmParameters = 'utm_source=RandomWallpaperGnome3&utm_medium=referral&utm_campaign=api-credit';

		session.queue_message(message, (session, message) => {
			let data = JSON.parse(message.response_body.data);

			let authorName = data.user.name;
			let authorUrl = encodeURI(data.user.links.html);

			let downloadLocation = data.links.download_location + '?' + clientParam;
			let downloadMessage = Soup.Message.new('GET', downloadLocation);

			session.queue_message(downloadMessage, (session, message) => {
				let downloadData = JSON.parse(message.response_body.data);

				let imageUrl = encodeURI(downloadData.url + '&' + utmParameters);

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(authorName, this.sourceName, encodeURI(imageUrl));
					historyEntry.source.sourceUrl = encodeURI(this.sourceUrl + '?' + utmParameters);
					historyEntry.source.authorUrl = encodeURI(authorUrl + '?' + utmParameters);
					callback(historyEntry);
				}
			});
		});
	},

	_generateOptionsString: function () {
		let options = this.options;
		let optionsString = "";

		for (let key in options) {
			if (options.hasOwnProperty(key)) {
				if (options[key]) {
					optionsString += key + "=" + options[key] + "&";
				}
			}
		}

		return optionsString;
	},

	_readOptionsFromSettings: function () {
		this.options.query = this._settings.get('unsplash-keyword', 'string');

		this.options.username = this._settings.get('username', 'string');
		if (this.options.username && this.options.username[0] === '@') {
			this.options.username = this.options.username.substring(1); // remove @ prefix
		}

		this.options.w = this._settings.get('image-width', 'int');
		this.options.h = this._settings.get('image-height', 'int');

		this.options.featured = this._settings.get('featured-only', 'boolean');
	}
});

var WallheavenAdapter = new Lang.Class({
	Name: "WallheavenAdapter",
	Extends: BaseAdapter,
	_settings: null,

	// query options
	options: {
		'q': '',
		'purity': '110', // SFW, sketchy
		'sorting': 'random',
		'categories': '111', // General, Anime, People
		'resolutions': ['1920x1200', '2560x1440']
	},

	_init: function () {
		this.parent();

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_WALLHEAVEN);
	},

	requestRandomImage: function (callback) {
		let session = new Soup.SessionAsync();

		this._readOptionsFromSettings();
		let optionsString = this._generateOptionsString();
		let url = 'http://alpha.wallhaven.cc/search?' + optionsString;
		url = encodeURI(url);

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
				imageUrl = encodeURI(imageUrl);

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(null, 'wallhaven.cc', imageUrl);
					historyEntry.source.sourceUrl = 'https://alpha.wallhaven.cc/';
					callback(historyEntry);
				}
			})


		});
	},

	_generateOptionsString: function () {
		let options = this.options;
		let optionsString = "";

		for (let key in options) {
			if (options.hasOwnProperty(key)) {
				if (Array.isArray(options[key])) {
					optionsString += key + "=" + options[key].join() + "&";
				} else {
					if (options[key]) {
						optionsString += key + "=" + options[key] + "&";
					}
				}
			}
		}

		return optionsString;
	},

	_readOptionsFromSettings: function () {
		this.options.q = this._settings.get('wallheaven-keyword', 'string');

		this.options.resolutions = this._settings.get('resolutions', 'string').split(',');
		this.options.resolutions = this.options.resolutions.map((elem) => {
			return elem.trim();
		});

		let categories = [];
		categories.push(+this._settings.get('category-general', 'boolean')); // + is implicit conversion to int
		categories.push(+this._settings.get('category-anime', 'boolean'));
		categories.push(+this._settings.get('category-people', 'boolean'));
		this.options.categories = categories.join('');

		let purity = [];
		purity.push(+this._settings.get('allow-sfw', 'boolean'));
		purity.push(+this._settings.get('allow-sketchy', 'boolean'));
		purity.push(0); // required by wallheaven
		this.options.purity = purity.join('');
	}
});

var GenericJsonAdapter = new Lang.Class({
	Name: "GenericJsonAdapter",
	Extends: BaseAdapter,

	_settings: null,
	_jsonPathParser: null,

	_init: function () {
		this.parent();
		this._jsonPathParser = new JSONPath.JSONPathParser();
		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_GENERIC_JSON);
	},

	requestRandomImage: function (callback) {
		let session = new Soup.SessionAsync();

		let url = this._settings.get("generic-json-request-url", "string");
		url = encodeURI(url);

		let message = Soup.Message.new('GET', url);

		session.queue_message(message, (session, message) => {
			let response = JSON.parse(message.response_body.data);
			let JSONPath = this._settings.get("generic-json-response-path", "string");
			let imageUrl = this._jsonPathParser.access(response, JSONPath);
			imageUrl = this._settings.get("generic-json-url-prefix", "string") + imageUrl;

			if (callback) {
				let historyEntry = new HistoryModule.HistoryEntry(null, 'Generic JSON Source', imageUrl);
				historyEntry.source.sourceUrl = imageUrl;
				callback(historyEntry);
			}
		});

	}
});
