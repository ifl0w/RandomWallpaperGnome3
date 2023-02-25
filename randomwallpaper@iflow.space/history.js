// Filesystem
const Gio = imports.gi.Gio;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Prefs = Self.imports.settings;

const LoggerModule = Self.imports.logger;

var HistoryEntry = class {

	constructor(author, source, url) {
		this.id = null;
		this.name = null;
		this.path = null;
		this.source = null;
		this.timestamp = new Date().getTime();

		this.source = {
			author: author,
			authorUrl: null,
			source: source,
			sourceUrl: null,
			imageDownloadUrl: url, // URL used for downloading the image
			imageLinkUrl: url // URL used for linking back to the website of the image
		};
	}

};

var HistoryController = class {

	constructor(wallpaperlocation) {
		this.logger = new LoggerModule.Logger('RWG3', 'HistoryController');
		this.size = 10;
		this.history = [];
		this._settings = new Prefs.Settings();
		this._wallpaperlocation = wallpaperlocation;

		this.load();
	}

	insert(historyElement) {
		this.history.unshift(historyElement);
		this._deleteOldPictures();
		this.save();
	}

	/**
	 * Set the given id to to the first history element (the current one)
	 * @param id
	 * @returns {boolean}
	 */
	promoteToActive(id) {
		let element = this.get(id);
		if (element === null) {
			return false;
		}

		element.timestamp = new Date().getTime();
		this.history = this.history.sort((elem1, elem2) => {
			return elem1.timestamp < elem2.timestamp
		});
		this.save();

		return true;
	}

	/**
	 * Returns the corresponding HistoryEntry or null
	 * @param id
	 * @returns {*}
	 */
	get(id) {
		for (let elem of this.history) {
			if (elem.id == id) {
				return elem;
			}
		}

		return null;
	}

	/**
	 * Load the history from the gschema
	 */
	load() {
		this.size = this._settings.get('history-length', 'int');
		let stringHistory = this._settings.get('history', 'strv');
		this.history = stringHistory.map(elem => {
			return JSON.parse(elem)
		});
	}

	/**
	 * Save the history to the gschema
	 */
	save() {
		let stringHistory = this.history.map(elem => {
			return JSON.stringify(elem)
		});
		this._settings.set('history', 'strv', stringHistory);
		Gio.Settings.sync();
	}

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

		} while (fileinfo);

		this.save();
		return true;
	}

	/**
	 * Delete all pictures that have no slot in the history.
	 * @private
	 */
	_deleteOldPictures() {
		this.size = this._settings.get('history-length', 'int');
		let deleteFile;
		while (this.history.length > this.size) {
			deleteFile = Gio.file_new_for_path(this.history.pop().path);
			deleteFile.delete(null);
		}
	}

};
