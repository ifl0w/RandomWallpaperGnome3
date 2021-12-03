const Self = imports.misc.extensionUtils.getCurrentExtension();

// network requests
const Soup = imports.gi.Soup;

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

var UnsplashAdapter = class extends BaseAdapter {

	constructor() {
		super();

		this.sourceName = 'Unsplash';
		this.sourceUrl = 'https://source.unsplash.com';

		// query options
		this.options = {
			'query': '',
			'w': 1920,
			'h': 1080,
			'featured': false,
			'constraintType': '',
			'constraintValue': '',
		};

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_UNSPLASH);
	}

	requestRandomImage(callback) {
		let session = new Soup.Session();

		this._readOptionsFromSettings();
		let optionsString = this._generateOptionsString();

		let url = `https://source.unsplash.com${optionsString}`;
		url = encodeURI(url);

		let message = Soup.Message.new('GET', url);

		this.logger.info(`Unsplash request to: ${url}`);

		// unsplash redirects to actual file; we only want the file location
		message.set_flags(Soup.MessageFlags.NO_REDIRECT);

		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		session.queue_message(message, (session, message) => {
			let imageLinkUrl;

			// expecting redirect
			if (message.status_code !== 302) {
				this._error("Unexpected response status code (expected 302)", callback);
			}

			imageLinkUrl = message.response_headers.get_one('Location');

			let historyEntry = new HistoryModule.HistoryEntry(null, this.sourceName, imageLinkUrl);
			historyEntry.source.sourceUrl = this.sourceUrl;
			historyEntry.source.imageLinkUrl = imageLinkUrl;
			callback(historyEntry);
		});
	}

	_generateOptionsString() {
		let options = this.options;
		let optionsString = "";

		switch (options.constraintType) {
			case 'user':
				optionsString = `/user/${options.constraintValue}/`;
				break;
			case 'likes':
				optionsString = `/user/${options.constraintValue}/likes/`;
				break;
			case 'collection':
				optionsString = `/collection/${options.constraintValue}/`;
				break;
			default:
				if (options.featured) {
					optionsString = `/featured/`;
				} else {
					optionsString = `/random/`;
				}
		}

		if (options.w && options.h) {
			optionsString += `${options.w}x${options.h}`;
		}

		if (options.query) {
			let q = options.query.replace(/\W/, ',');
			optionsString += `?${q}`;
		}

		return optionsString;
	}

	_readOptionsFromSettings() {
		this.options.w = this._settings.get('unsplash-image-width', 'int');
		this.options.h = this._settings.get('unsplash-image-height', 'int');

		this.options.constraintType = this._settings.get('unsplash-constraint-type', 'string');
		this.options.constraintValue = this._settings.get('unsplash-constraint-value', 'string');

		const keywords = this._settings.get('unsplash-keyword', 'string').split(",");
		if (keywords.length > 0) {
			const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
			this.options.query = randomKeyword.trim();
		}

		this.options.featured = this._settings.get('unsplash-featured-only', 'boolean');
	}
};

var WallhavenAdapter = class extends BaseAdapter {

	constructor() {
		super();

		this.options = {
			'q': '',
			'apikey': '',
			'purity': '110', // SFW, sketchy
			'sorting': 'random',
			'categories': '111', // General, Anime, People
			'resolutions': ['1920x1200', '2560x1440']
		};

		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_WALLHAVEN);
	}

	requestRandomImage(callback) {
		let session = new Soup.Session();

		this._readOptionsFromSettings();
		let optionsString = this._generateOptionsString();
		let url = 'https://wallhaven.cc/api/v1/search?' + encodeURI(optionsString);

		let message = Soup.Message.new('GET', url);

		session.queue_message(message, (session, message) => {
			let images = JSON.parse(message.response_body.data).data;

			if (!images || images.length === 0) {
				this._error("No image found. body:"+images, callback);
				return;
			}

			// get a random entry from the array
			let imageUrl = images[Math.floor(Math.random() * images.length)].path;

			let apiKey = this.options["apikey"];
			if(apiKey){
				imageUrl += "?apikey="+apiKey;
			}

			if (callback) {
				let historyEntry = new HistoryModule.HistoryEntry(null, 'Wallhaven', imageUrl);
				historyEntry.source.sourceUrl = 'https://wallhaven.cc/';
				historyEntry.source.imageLinkUrl = url;
				callback(historyEntry);
			}
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
		const keywords = this._settings.get('wallhaven-keyword', 'string').split(",");
		if (keywords.length > 0) {
			const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
			this.options.q = randomKeyword.trim();
		}
		this.options.apikey = this._settings.get('wallhaven-api-key', 'string');

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
		purity.push(+this._settings.get('allow-nsfw', 'boolean'));
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
		let session = new Soup.Session();

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
		let session = new Soup.Session();

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
