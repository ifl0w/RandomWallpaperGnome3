const Self = imports.misc.extensionUtils.getCurrentExtension();
const SettingsModule = Self.imports.settings;
const HistoryModule = Self.imports.history;
const SoupBowl = Self.imports.soupBowl;

const BaseAdapter = Self.imports.adapter.baseAdapter;

var UnsplashAdapter = class extends BaseAdapter.BaseAdapter {
	constructor(id, name, wallpaperLocation) {
		// Make sure we're not picking up a valid config
		if (id === null) {
			id = -1;
		}

		super({
			id: id,
			schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH,
			schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/unsplash/${id}/`,
			wallpaperLocation: wallpaperLocation,
			name: name,
			defaultName: 'Unsplash'
		});

		this._sourceUrl = 'https://source.unsplash.com';

		// query options
		this.options = {
			'query': '',
			'w': 1920,
			'h': 1080,
			'featured': false,
			'constraintType': 0,
			'constraintValue': '',
		};

		this.bowl = new SoupBowl.Bowl();
	}

	_getHistoryEntry() {
		return new Promise((resolve, reject) => {
			this._readOptionsFromSettings();
			let optionsString = this._generateOptionsString();

			let url = `https://source.unsplash.com${optionsString}`;
			url = encodeURI(url);

			this.logger.info(`Unsplash request to: ${url}`);

			let message = this.bowl.Soup.Message.new('GET', url);
			if (message === null) {
				reject("Could not create request.");
			}

			// unsplash redirects to actual file; we only want the file location
			message.set_flags(this.bowl.Soup.MessageFlags.NO_REDIRECT);

			this.bowl.send_and_receive(message, (_null_expected) => {
				let imageLinkUrl;

				// expecting redirect
				if (message.status_code !== 302) {
					reject("Unexpected response status code (expected 302)");
				}

				imageLinkUrl = message.response_headers.get_one('Location');

				if (this._isImageBlocked(this.fileName(imageLinkUrl))) {
					// Abort and try again
					resolve(null);
				}

				let historyEntry = new HistoryModule.HistoryEntry(null, this._sourceName, imageLinkUrl);
				historyEntry.source.sourceUrl = this._sourceUrl;
				historyEntry.source.imageLinkUrl = imageLinkUrl;

				resolve(historyEntry);
			});
		});
	}

	async requestRandomImage(callback) {
		for (let i = 0; i < 5; i++) {
			try {
				let historyEntry = await this._getHistoryEntry();

				if (historyEntry === null) {
					// Image blocked, try again
					continue;
				}

				if (callback) {
					callback(historyEntry);
				}

				return;
			} catch (error) {
				this._error(error, callback);
				return;
			}
		}

		this._error("Only blocked images found.", callback);
	}

	_generateOptionsString() {
		let options = this.options;
		let optionsString = "";

		switch (options.constraintType) {
			case 1:
				optionsString = `/user/${options.constraintValue}/`;
				break;
			case 2:
				optionsString = `/user/${options.constraintValue}/likes/`;
				break;
			case 3:
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

		this.options.constraintType = this._settings.get('constraint-type', 'enum');
		this.options.constraintValue = this._settings.get('constraint-value', 'string');

		const keywords = this._settings.get('keyword', 'string').split(",");
		if (keywords.length > 0) {
			const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
			this.options.query = randomKeyword.trim();
		}

		this.options.featured = this._settings.get('featured-only', 'boolean');
	}
};
