const Self = imports.misc.extensionUtils.getCurrentExtension();

// network requests
const Soup = imports.gi.Soup;

const RWG_SETTINGS_SCHEMA_DESKTOPPER = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.desktopper';
const RWG_SETTINGS_SCHEMA_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.unsplash';
const RWG_SETTINGS_SCHEMA_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.wallhaven';
const RWG_SETTINGS_SCHEMA_REDDIT = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.reddit';
const RWG_SETTINGS_SCHEMA_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.genericJSON';

const SettingsModule = Self.imports.settings;
const HistoryModule = Self.imports.history;

const LoggerModule = Self.imports.logger;
const JSONPath = Self.imports.jsonpath.jsonpath;

var BaseAdapter = class {

	constructor() {
		this.logger = new LoggerModule.Logger('RWG3', 'BaseAdapter');
	}

	/**
	 * Retrieves a new url for an image and calls the given callback with an HistoryEntry as parameter.
	 * The history element will be null and the error will be set if an error occurred.
	 *
	 * @param callback(historyElement, error)
	 */
	requestRandomImage(callback) {
		this._error("requestRandomImage not implemented", callback);
	}

	fileName(uri) {
		while (this._isURIEncoded(uri)) {
			uri = decodeURIComponent(uri);
		}

		let base = uri.substring(uri.lastIndexOf('/') + 1);
		if (base.indexOf('?') >= 0) {
			base = base.substr(0, base.indexOf('?'));
		}
		return base;
	}

	_isURIEncoded(uri) {
		uri = uri || '';

		try {
			return uri !== decodeURIComponent(uri);
		} catch (err) {
			this.logger.error(err);
			return false;
		}
	}

	_error(err, callback) {
		let error = {"error": err};
		this.logger.error(JSON.stringify(error));

		if (callback) {
			callback(null, error);
		}
	}

};

var DesktopperAdapter = class extends BaseAdapter {

	constructor() {
		super();

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_DESKTOPPER);
	}

	requestRandomImage(callback) {
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

		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		session.queue_message(message, (session, message) => {
			try {
				let data = JSON.parse(message.response_body.data);
				let response = data.response;
				let imageDownloadUrl = encodeURI(response.image.url);

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(null, 'Desktopper', imageDownloadUrl);
					historyEntry.source.sourceUrl = 'https://www.desktoppr.co/';
					callback(historyEntry);
				}
			} catch (e) {
				this._error("Could not create request. (" + e + ")", callback);
				return;
			}
		});
	}

};

var UnsplashAdapter = class extends BaseAdapter {

	constructor() {
		super();

		this.sourceName = 'Unsplash';
		this.sourceUrl = 'https://unsplash.com/';

		// query options
		this.options = {
			'username': '',
			'query': '',
			'collections': [],
			'w': 1920,
			'h': 1080,
			'featured': false
		};

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_UNSPLASH);
	}

	requestRandomImage(callback) {
		let session = new Soup.SessionAsync();

		this._readOptionsFromSettings();
		let optionsString = this._generateOptionsString();
		let clientParam = 'client_id=64daf439e9b579dd566620c0b07022706522d87b255d06dd01d5470b7f193b8d';

		let url = 'https://api.unsplash.com/photos/random?' + optionsString + clientParam;
		url = encodeURI(url);

		let message = Soup.Message.new('GET', url);

		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		let utmParameters = 'utm_source=RandomWallpaperGnome3&utm_medium=referral&utm_campaign=api-credit';

		session.queue_message(message, (session, message) => {
			let downloadMessage = null;
			let authorName, authorUrl, imageLinkUrl;

			try {
				let data = JSON.parse(message.response_body.data);

				authorName = data.user.name;
				authorUrl = encodeURI(data.user.links.html);
				imageLinkUrl = encodeURI(data.links.html);

				let downloadLocation = data.links.download_location + '?' + clientParam;
				downloadMessage = Soup.Message.new('GET', downloadLocation);
			} catch (e) {
				this._error("Unexpected response. (" + e + ")", callback);
				return;
			}

			if (message === null) {
				this._error("Could not create request.", callback);
				return;
			}

			session.queue_message(downloadMessage, (session, message) => {
				try {
					let downloadData = JSON.parse(message.response_body.data);

					if (callback) {
						let historyEntry = new HistoryModule.HistoryEntry(authorName, this.sourceName, encodeURI(downloadData.url));
						historyEntry.source.sourceUrl = encodeURI(this.sourceUrl + '?' + utmParameters);
						historyEntry.source.authorUrl = encodeURI(authorUrl + '?' + utmParameters);
						historyEntry.source.imageLinkUrl = imageLinkUrl + '?' + utmParameters;
						callback(historyEntry);
					}
				} catch (e) {
					this._error("Unexpected response. (" + e + ")", callback);
					return;
				}
			});
		});
	}

	_generateOptionsString() {
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
	}

	_readOptionsFromSettings() {
		this.options.query = this._settings.get('unsplash-keyword', 'string');

		this.options.username = this._settings.get('unsplash-username', 'string');
		if (this.options.username && this.options.username[0] === '@') {
			this.options.username = this.options.username.substring(1); // remove @ prefix
		}

		this.options.collections = this._settings.get('unsplash-collections', 'string').split(',').map(
			(elem) => {
				return elem.trim();
			});

		this.options.w = this._settings.get('image-width', 'int');
		this.options.h = this._settings.get('image-height', 'int');

		this.options.featured = this._settings.get('featured-only', 'boolean');
	}
};

var WallhavenAdapter = class extends BaseAdapter {

	constructor() {
		super();

		this.options = {
			'q': '',
			'purity': '110', // SFW, sketchy
			'sorting': 'random',
			'categories': '111', // General, Anime, People
			'resolutions': ['1920x1200', '2560x1440']
		};

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_WALLHAVEN);
	}

	requestRandomImage(callback) {
		let session = new Soup.SessionAsync();

		this._readOptionsFromSettings();
		let optionsString = this._generateOptionsString();
		let url = 'https://wallhaven.cc/search?' + encodeURI(optionsString);

		let message = Soup.Message.new('GET', url);

		session.queue_message(message, (session, message) => {
			let body = message.response_body.data;
			let urlArray = body.match(new RegExp(/https:\/\/wallhaven.cc\/w\/[0-9a-z]+/g));

			if (!urlArray || urlArray.length === 0) {
				this._error("No image found.", callback);
				return;
			}

			// remove dublicates from array
			let uniqueUrlArray = urlArray.filter(function (item, pos) {
				return urlArray.indexOf(item) == pos;
			});

			// get a random entry from the array
			let url = uniqueUrlArray[Math.floor(Math.random() * uniqueUrlArray.length)];

			message = Soup.Message.new('GET', url);

			if (message === null) {
				this._error("Could not create request.", callback);
				return;
			}

			session.queue_message(message, () => {
				try {
					let body = message.response_body.data;
					let imageDownloadUrl = body.match(new RegExp(/"(https:\/\/w.wallhaven.cc\/full\/.*?)"/))[1];

					if (callback) {
						let historyEntry = new HistoryModule.HistoryEntry(null, 'Wallhaven', imageDownloadUrl);
						historyEntry.source.sourceUrl = 'https://wallhaven.cc/';
						historyEntry.source.imageLinkUrl = url;
						callback(historyEntry);
					}
				} catch (e) {
					this._error("Unexpected response. (" + e + ")", callback);
				}
			})

		});
	}

	_generateOptionsString() {
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
	}

	_readOptionsFromSettings() {
		this.options.q = this._settings.get('wallhaven-keyword', 'string');

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
		purity.push(0); // required by wallhaven
		this.options.purity = purity.join('');
	}
};

var RedditAdapter = class extends BaseAdapter {

	constructor() {
		super();

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_REDDIT);
	}

	_ampDecode(string) {
		return string.replace(/\&amp;/g, '&');
	}

	requestRandomImage(callback) {
		let session = new Soup.SessionAsync();

		const subreddits = this._settings.get('subreddits', 'string').split(',').map(s => s.trim()).join('+');
		const require_sfw = this._settings.get('allow-sfw', 'boolean');
		const url = encodeURI('https://www.reddit.com/r/' + subreddits + '.json');

		let message = Soup.Message.new('GET', url);

		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		session.queue_message(message, (session, message) => {
			try {
				const submissions = JSON.parse(message.response_body.data).data.children.filter(child => {
					if (child.data.post_hint !== 'image') return false;
					if (require_sfw) return child.data.over_18 === false;
					return true;
				});
				if (submissions.length === 0) {
					this._error("No suitable submissions found!", callback);
					return;
				}
				const random = Math.floor(Math.random() * submissions.length);
				const submission = submissions[random].data;
				const imageDownloadUrl = this._ampDecode(submission.preview.images[0].source.url);

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(null, 'Reddit', imageDownloadUrl);
					historyEntry.source.sourceUrl = 'https://www.reddit.com/' + submission.subreddit_name_prefixed;
					historyEntry.source.imageLinkUrl = 'https://www.reddit.com/' + submission.permalink;
					callback(historyEntry);
				}
			} catch (e) {
				this._error("Could not create request. (" + e + ")", callback);
			}
		});
	}

};

var GenericJsonAdapter = class extends BaseAdapter {

	constructor() {
		super();
		this._jsonPathParser = new JSONPath.JSONPathParser();
		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_GENERIC_JSON);
	}

	requestRandomImage(callback) {
		let session = new Soup.SessionAsync();

		let url = this._settings.get("generic-json-request-url", "string");
		url = encodeURI(url);

		let message = Soup.Message.new('GET', url);

		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		session.queue_message(message, (session, message) => {
			try {
				let response = JSON.parse(message.response_body.data);
				let JSONPath = this._settings.get("generic-json-response-path", "string");
				let imageDownloadUrl = this._jsonPathParser.access(response, JSONPath);
				imageDownloadUrl = this._settings.get("generic-json-url-prefix", "string") + imageDownloadUrl;

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(null, 'Generic JSON Source', imageDownloadUrl);
					historyEntry.source.sourceUrl = imageDownloadUrl;
					callback(historyEntry);
				}
			} catch (e) {
				this._error("Unexpected response. (" + e + ")", callback);
			}
		});

	}

};
