const Lang = imports.lang;
const Glib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

var Settings = new Lang.Class({
	Name: "Settings",
	_settings: null,

	/**
	 * Settings object.
	 *
	 * @param [schema]
	 * @private
	 */
	_init: function (schema) {
		this._settings = Convenience.getSettings(schema);
	},

	observe: function (key, callback) {
		this._settings.connect('changed::' + key, callback);
	},

	set: function (key, type, value) {
		if (this._settings['set_' + type](key, value)) {
			Gio.Settings.sync(); // wait for write
		} else {
			throw "Could not set " + key + " (type: " + type + ") with the value " + value;
		}
	},

	get: function (key, type) {
		return this._settings['get_' + type](key);
	},

	getSourceAdapter: function () {
		global.log(this._settings.get_enum('source'));
		return null;
	}
});
