const Self = imports.misc.extensionUtils.getCurrentExtension();
const SettingsModule = Self.imports.settings;
const HistoryModule = Self.imports.history;
const SoupBowl = Self.imports.soupBowl;

const BaseAdapter = Self.imports.adapter.baseAdapter;

const RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.unsplash';

var UnsplashAdapter = class extends BaseAdapter.BaseAdapter {
	constructor(id, name, wallpaperLocation) {
		super(wallpaperLocation);

		this._sourceName = name;
		if (this._sourceName === null || this._sourceName === "") {
			this._sourceName = 'Unsplash';
		}

		this._sourceUrl = 'https://source.unsplash.com';

		// query options
		this.options = {
			'query': '',
			'w': 1920,
			'h': 1080,
			'featured': false,
			'constraintType': '',
			'constraintValue': '',
		};

		if (id === null) {
			id = -1;
		}

		let path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/unsplash/${id}/`;
		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH, path);
		this.bowl = new SoupBowl.Bowl();
	}

	requestRandomImage(callback) {
		this._readOptionsFromSettings();
		let optionsString = this._generateOptionsString();

		let url = `https://source.unsplash.com${optionsString}`;
		url = encodeURI(url);

		this.logger.info(`Unsplash request to: ${url}`);
		let message = this.bowl.Soup.Message.new('GET', url);
		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		// unsplash redirects to actual file; we only want the file location
		message.set_flags(this.bowl.Soup.MessageFlags.NO_REDIRECT);

		this.bowl.send_and_receive(message, (_null_expected) => {
			let imageLinkUrl;

			// expecting redirect
			if (message.status_code !== 302) {
				this._error("Unexpected response status code (expected 302)", callback);
			}

			imageLinkUrl = message.response_headers.get_one('Location');

			let historyEntry = new HistoryModule.HistoryEntry(null, this._sourceName, imageLinkUrl);
			historyEntry.source.sourceUrl = this._sourceUrl;
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
		this.options.w = this._settings.get('image-width', 'int');
		this.options.h = this._settings.get('image-height', 'int');

		this.options.constraintType = this._settings.get('constraint-type', 'string');
		this.options.constraintValue = this._settings.get('constraint-value', 'string');

		const keywords = this._settings.get('keyword', 'string').split(",");
		if (keywords.length > 0) {
			const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
			this.options.query = randomKeyword.trim();
		}

		this.options.featured = this._settings.get('featured-only', 'boolean');
	}
};
