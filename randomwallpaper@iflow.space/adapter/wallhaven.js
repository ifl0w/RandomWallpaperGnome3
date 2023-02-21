const ByteArray = imports.byteArray;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const SettingsModule = Self.imports.settings;
const HistoryModule = Self.imports.history;
const SoupBowl = Self.imports.soupBowl;

const BaseAdapter = Self.imports.adapter.baseAdapter;

const RWG_SETTINGS_SCHEMA_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.wallhaven';

var WallhavenAdapter = class extends BaseAdapter.BaseAdapter {
	constructor(id, wallpaperLocation) {
		super(wallpaperLocation);

		this.options = {
			'q': '',
			'apikey': '',
			'purity': '110', // SFW, sketchy
			'sorting': 'random',
			'categories': '111', // General, Anime, People
			'resolutions': ['1920x1200', '2560x1440']
		};

		let path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/wallhaven/${id}/`;
		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_WALLHAVEN, path);
		this.bowl = new SoupBowl.Bowl();
	}

	requestRandomImage(callback) {
		this._readOptionsFromSettings();
		let optionsString = this._generateOptionsString();

		let identifier = this._settings.get("name", "string");
		if (identifier === null || identifier === "") {
			identifier = 'Wallhaven';
		}

		let url = 'https://wallhaven.cc/api/v1/search?' + encodeURI(optionsString);
		let message = this.bowl.Soup.Message.new('GET', url);
		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		this.bowl.send_and_receive(message, (response_body_bytes) => {
			const response_body = ByteArray.toString(response_body_bytes);

			let response = JSON.parse(response_body).data;

			if (!response || response.length === 0) {
				this._error("Failed to request image.", callback);
				return;
			}

			// get a random entry from the array
			let entry = response[Math.floor(Math.random() * response.length)];
			let downloadURL = entry.path;
			let siteURL = entry.url;

			let apiKey = this.options["apikey"];
			if (apiKey) {
				downloadURL += "?apikey=" + apiKey;
			}

			if (callback) {
				let historyEntry = new HistoryModule.HistoryEntry(null, identifier, downloadURL);
				historyEntry.source.sourceUrl = 'https://wallhaven.cc/';
				historyEntry.source.imageLinkUrl = siteURL;
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
		const keywords = this._settings.get('keyword', 'string').split(",");
		if (keywords.length > 0) {
			const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
			this.options.q = randomKeyword.trim();
		}
		this.options.apikey = this._settings.get('api-key', 'string');

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
