const Lang = imports.lang;
const Mainloop = imports.gi.GLib;

// Filesystem
const Gio = imports.gi.Gio;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Prefs = Self.imports.settings;

const LoggerModule = Self.imports.logger;

let HistoryEntry = new Lang.Class({
	Name: "HistoryEntry",
	timestamp: null,
	id: null,
	path: null,
	src: null,

	_init: function(historyId, path, src) {
		this.timestamp = new Date().getTime();
		this.id = historyId;
		this.path = path;
		this.src = src;
	},
});

let HistoryController = new Lang.Class({
	Name: "HistoryController",
	_settings: null,
	_wallpaperlocation: null,

	logger: null,
	size: 10,
	history: [],

	_init: function(wallpaperlocation) {
		this.logger = new LoggerModule.Logger('RWG3', 'HistoryController');

		this._settings = new Prefs.Settings();
		this._wallpaperlocation = wallpaperlocation;

		this.load();
	},

	insert: function(historyElement) {
		this.history.unshift(historyElement);
		this._deleteOldPictures();
		this.save();
	},

	/**
	 * Set the given id to to the first history element (the current one)
	 * @param id
	 * @returns {boolean}
	 */
	promoteToActive: function(id) {
		let element = this.get(id);
		if (element === null) {
			return false;
		}

		element.timestamp = new Date().getTime();
		this.history = this.history.sort((elem1, elem2) => { return elem1.timestamp < elem2.timestamp });
		this.save();

		return true;
	},

	/**
	 * Returns the corresponding HistoryEntry or null
	 * @param id
	 * @returns {*}
	 */
	get: function(id) {
		for (let elem of this.history) {
			if (elem.id == id) {
				return elem;
			}
		}

		return null;
	},

	/**
	 * Load the history from the gschema
	 */
	load: function() {
		this.size = this._settings.get('history-length', 'int');
		let stringHistory = this._settings.get('history', 'strv');
		this.history = stringHistory.map(elem => {
			return JSON.parse(elem)
		});
	},

	/**
	 * Save the history to the gschema
	 */
	save: function() {
		let stringHistory = this.history.map(elem => { return JSON.stringify(elem) });
		this._settings.set('history', 'strv', stringHistory);
	},

	/**
	 * Clear the history and delete all photos except the current one.
	 * @returns {boolean}
	 */
	clear() {
		let firstHistoryElement = this.history[0];

		if (firstHistoryElement)
			this.history = [firstHistoryElement];

		let directory = Gio.file_new_for_path(this._wallpaperlocation);
		let enumerator = directory.enumerate_children('', Gio.FileQueryInfoFlags.NONE, null);

		let fileinfo;
		let deleteFile;

		do {

			fileinfo = enumerator.next_file(null);

			if (!fileinfo) {
				break;
			}

			let id = fileinfo.get_name();

			// ignore hidden files and first element
			if (id[0] != '.' && id != firstHistoryElement.id) {
				deleteFile = Gio.file_new_for_path(this._wallpaperlocation + id);
				deleteFile.delete(null);
			}

		} while(fileinfo);

		this.save();
		return true;
	},

	/**
	 * Delete all pictures that have no slot in the history.
	 * @private
	 */
	_deleteOldPictures: function() {
		this.size = this._settings.get('history-length', 'int');
		let deleteFile;
		while(this.history.length > this.size) {
			deleteFile = Gio.file_new_for_path(this.history.pop().path);
			deleteFile.delete(null);
		}
	},

});