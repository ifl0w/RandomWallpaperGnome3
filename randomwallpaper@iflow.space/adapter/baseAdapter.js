const Gio = imports.gi.Gio;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const LoggerModule = Self.imports.logger;
const SettingsModule = Self.imports.settings;

/*
 libSoup is accessed through the SoupBowl wrapper to support libSoup3 and libSoup2.4 simultaneously in the extension
 runtime and in the preferences window.
 */
const SoupBowl = Self.imports.soupBowl;

const RWG_SETTINGS_SCHEMA_SOURCES_GENERAL = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.general';

var BaseAdapter = class {
	constructor(params = {}) {
		this.logger = new LoggerModule.Logger('RWG3', 'BaseAdapter');
		this._settings = new SettingsModule.Settings(params.schemaID, params.schemaPath);
		this._wallpaperLocation = params.wallpaperLocation;

		this._sourceName = params.name;
		if (this._sourceName === null || this._sourceName === "") {
			this._sourceName = params.defaultName;
		}

		let path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/general/${params.id}/`;
		this._generalSettings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);
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

	/**
	 * copy file from uri to local wallpaper directory and calls the given callback with the name and the full filepath
	 * of the written file as parameter.
	 * @param uri
	 * @param callback(name, path, error)
	 */
	fetchFile(uri, callback) {
		//extract the name from the url and
		let name = this.fileName(uri);

		let bowl = new SoupBowl.Bowl();

		let file = Gio.file_new_for_path(this._wallpaperLocation + String(name));
		let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

		// start the download
		let request = bowl.Soup.Message.new('GET', uri);

		bowl.send_and_receive(request, (response_data_bytes) => {
			if (!response_data_bytes) {
				fstream.close(null);

				if (callback) {
					callback(null, null, 'Not a valid response');
				}

				return;
			}

			try {
				fstream.write(response_data_bytes, null);

				fstream.close(null);

				// call callback with the name and the full filepath of the written file as parameter
				if (callback) {
					callback(name, file.get_path());
				}
			} catch (e) {
				if (callback) {
					callback(null, null, e);
				}
			}
		});
	}

	_isImageBlocked(filename) {
		let blockedFilenames = this._generalSettings.get('blocked-images', 'strv');

		if (blockedFilenames.includes(filename)) {
			this.logger.warn(`Image is blocked: ${filename}`);
			return true;
		}

		return false;
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
		let error = { "error": err };
		this.logger.error(JSON.stringify(error));

		if (callback) {
			callback(null, error);
		}
	}
};
