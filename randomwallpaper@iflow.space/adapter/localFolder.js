const Gio = imports.gi.Gio;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const SettingsModule = Self.imports.settings;
const HistoryModule = Self.imports.history;

const BaseAdapter = Self.imports.adapter.baseAdapter;

const RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.localFolder';

var LocalFolderAdapter = class extends BaseAdapter.BaseAdapter {
	constructor(id, name, wallpaperLocation) {
		super(wallpaperLocation);

		this._sourceName = name;
		if (this._sourceName === null || this._sourceName === "") {
			this._sourceName = 'Local Folder';
		}

		let path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/localFolder/${id}/`;
		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER, path);
	}

	requestRandomImage(callback) {
		const folder = Gio.File.new_for_path(this._settings.get('folder', 'string'));
		let files = this._listDirectory(folder);

		if (files === null || files.length < 1) {
			this._error("Empty array.", callback);
		}

		let randomFile = files[Math.floor(Math.random() * files.length)].get_path();

		if (callback) {
			let historyEntry = new HistoryModule.HistoryEntry(null, this._sourceName, randomFile);
			historyEntry.source.sourceUrl = this._wallpaperLocation;
			callback(historyEntry);
		}
	}

	fetchFile(path, callback) {
		let sourceFile = Gio.File.new_for_path(path);
		let name = sourceFile.get_basename()
		let targetFile = Gio.File.new_for_path(this._wallpaperLocation + String(name));

		// https://gjs.guide/guides/gio/file-operations.html#copying-and-moving-files
		sourceFile.copy(targetFile, Gio.FileCopyFlags.NONE, null, null);

		if (callback) {
			callback(name, targetFile.get_path());
		}
	}

	// https://gjs.guide/guides/gio/file-operations.html#recursively-deleting-a-directory
	_listDirectory(directory) {
		const iterator = directory.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);

		let files = [];
		while (true) {
			const info = iterator.next_file(null);

			if (info === null) {
				break;
			}

			const child = iterator.get_child(info);
			const type = info.get_file_type();

			switch (type) {
				case Gio.FileType.DIRECTORY:
					files = files.concat(this._listDirectory(child));
					break;

				default:
					break;
			}

			let contentType = info.get_content_type();
			if (contentType === 'image/png' || contentType === 'image/jpeg') {
				files.push(child);
			}
		}

		return files;
	}
};
