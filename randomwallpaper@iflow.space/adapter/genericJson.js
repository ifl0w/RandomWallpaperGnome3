const ByteArray = imports.byteArray;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const HistoryModule = Self.imports.history;
const JSONPath = Self.imports.jsonpath.jsonpath;
const SettingsModule = Self.imports.settings;
const SoupBowl = Self.imports.soupBowl;

const BaseAdapter = Self.imports.adapter.baseAdapter;

const RWG_SETTINGS_SCHEMA_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.genericJSON';

var GenericJsonAdapter = class extends BaseAdapter.BaseAdapter {
	constructor(id, wallpaperLocation) {
		super(wallpaperLocation);
		this._jsonPathParser = new JSONPath.JSONPathParser();
		let path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/genericJSON/${id}/`;
		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_GENERIC_JSON, path);
		this.bowl = new SoupBowl.Bowl();
	}

	requestRandomImage(callback) {
		let url = this._settings.get("request-url", "string");
		url = encodeURI(url);
		let message = this.bowl.Soup.Message.new('GET', url);
		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		this.bowl.send_and_receive(message, (response_body_bytes) => {
			try {
				const response_body = JSON.parse(ByteArray.toString(response_body_bytes));

				let imageJSONPath = this._settings.get("image-path", "string");
				let postJSONPath = this._settings.get("post-path", "string");
				let domainUrl = this._settings.get("domain", "string");
				let authorNameJSONPath = this._settings.get("author-name-path", "string");
				let authorUrlJSONPath = this._settings.get("author-url-path", "string");

				let identifier = this._settings.get("name", "string");
				if (identifier === null || identifier === "") {
					identifier = 'Generic JSON Source';
				}

				let rObject = this._jsonPathParser.access(response_body, imageJSONPath);
				let imageDownloadUrl = this._settings.get("image-prefix", "string") + rObject.Object;

				// '@random' would yield different results so lets make sure the values stay
				// the same as long as the path is identical
				let samePath = imageJSONPath.substring(0, this.findFirstDifference(imageJSONPath, postJSONPath));

				// count occurrences of '@random' to slice the array later
				// https://stackoverflow.com/a/4009768
				let occurrences = (samePath.match(/@random/g) || []).length;
				let slicedRandomElements = rObject.RandomElements.slice(0, occurrences);

				let postUrl = this._jsonPathParser.access(response_body, postJSONPath, slicedRandomElements, false).Object;
				postUrl = this._settings.get("post-prefix", "string") + postUrl;
				if (typeof postUrl !== 'string' || !postUrl instanceof String) {
					postUrl = null;
				}

				let authorName = this._jsonPathParser.access(response_body, authorNameJSONPath, slicedRandomElements, false).Object;
				if (typeof authorName !== 'string' || !authorName instanceof String) {
					authorName = null;
				}

				let authorUrl = this._jsonPathParser.access(response_body, authorUrlJSONPath, slicedRandomElements, false).Object;
				authorUrl = this._settings.get("author-url-prefix", "string") + authorUrl;
				if (typeof authorUrl !== 'string' || !authorUrl instanceof String) {
					authorUrl = null;
				}

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(authorName, identifier, imageDownloadUrl);

					if (authorUrl !== null && authorUrl !== "") {
						historyEntry.source.authorUrl = authorUrl;
					}

					if (postUrl !== null && postUrl !== "") {
						historyEntry.source.imageLinkUrl = postUrl;
					}

					if (domainUrl !== null && domainUrl !== "") {
						historyEntry.source.sourceUrl = domainUrl;
					}

					callback(historyEntry);
				}
			} catch (e) {
				this._error("Unexpected response. (" + e + ")", callback);
			}
		});
	}

	// https://stackoverflow.com/a/32859917
	findFirstDifference(jsonPath1, jsonPath2) {
		let i = 0;
		if (jsonPath1 === jsonPath2) return -1;
		while (jsonPath1[i] === jsonPath2[i]) i++;
		return i;
	}
};