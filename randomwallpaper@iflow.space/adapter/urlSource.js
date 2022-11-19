const Self = imports.misc.extensionUtils.getCurrentExtension();
const HistoryModule = Self.imports.history;
const JSONPath = Self.imports.jsonpath.jsonpath;
const SettingsModule = Self.imports.settings;

const BaseAdapter = Self.imports.adapter.baseAdapter;

const RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.urlSource';

var UrlSourceAdapter = class extends BaseAdapter.BaseAdapter {
	constructor(id, name, wallpaperLocation) {
		super({
			id: id,
			schemaID: RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE,
			schemaPath: `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/urlSource/${id}/`,
			wallpaperLocation: wallpaperLocation,
			name: name,
			defaultName: 'Static URL'
		});
	}

	requestRandomImage(callback) {
		let imageDownloadUrl = this._settings.get("image-url", "string");
		let authorName = this._settings.get("author-name", "string");
		let authorUrl = this._settings.get("author-url", "string");
		let domainUrl = this._settings.get("domain", "string");
		let postUrl = this._settings.get("domain", "string");

		if (typeof postUrl !== 'string' || !postUrl instanceof String) {
			postUrl = null;
		}

		if (typeof authorName !== 'string' || !authorName instanceof String) {
			authorName = null;
		}

		if (typeof authorUrl !== 'string' || !authorUrl instanceof String) {
			authorUrl = null;
		}

		if (callback) {
			let historyEntry = new HistoryModule.HistoryEntry(authorName, this._sourceName, imageDownloadUrl);

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
	}
};
