const Gio = imports.gi.Gio;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

var Settings = class {

	/**
	 * Settings object.
	 *
	 * @param [schema]
	 * @private
	 */
	constructor(schema) {
		this._settings = Convenience.getSettings(schema);
	}

	observe(key, callback) {
		return this._settings.connect('changed::' + key, callback);
	}

	disconnect(handler) {
		return this._settings.disconnect(handler);
	}

	set(key, type, value) {
		if (this._settings['set_' + type](key, value)) {
			Gio.Settings.sync(); // wait for write
		} else {
			throw "Could not set " + key + " (type: " + type + ") with the value " + value;
		}
	}

	get(key, type) {
		return this._settings['get_' + type](key);
	}

};
