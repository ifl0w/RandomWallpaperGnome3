const Gio = imports.gi.Gio;
const Utils = imports.misc.extensionUtils;

var RWG_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.space.iflow.randomwallpaper';
var RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.backend-connection';
var RWG_SETTINGS_SCHEMA_SOURCES_GENERAL = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.general';
var RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.genericJSON';
var RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.localFolder';
var RWG_SETTINGS_SCHEMA_SOURCES_REDDIT = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.reddit';
var RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.unsplash';
var RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.urlSource';
var RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.wallhaven';

var RWG_SETTINGS_SCHEMA_PATH = `/org/gnome/shell/extensions/space-iflow-randomwallpaper`;

var Settings = class {

	/**
	 * Settings object.
	 *
	 * @param [schema]
	 * @private
	 */
	constructor(schema, path = null) {
		this._settings = Utils.getSettings(schema, path);
	}

	bind(keyName, gObject, property, settingsBindFlags) {
		this._settings.bind(keyName, gObject, property, settingsBindFlags);
	}

	disconnect(handler) {
		return this._settings.disconnect(handler);
	}

	get(key, type) {
		return this._settings['get_' + type](key);
	}

	getSchema() {
		return this._settings.settings_schema;
	}

	observe(key, callback) {
		return this._settings.connect('changed::' + key, callback);
	}

	reset(keyName) {
		this._settings.reset(keyName);
	}

	set(key, type, value) {
		if (this._settings['set_' + type](key, value)) {
			Gio.Settings.sync(); // wait for write
		} else {
			throw "Could not set " + key + " (type: " + type + ") with the value " + value;
		}
	}
};
