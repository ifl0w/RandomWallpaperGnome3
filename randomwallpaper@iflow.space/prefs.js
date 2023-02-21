const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;

const Self = ExtensionUtils.getCurrentExtension();
const SourceRow = Self.imports.ui.sourceRow;
const Settings = Self.imports.settings;
const WallpaperController = Self.imports.wallpaperController;
const LoggerModule = Self.imports.logger;

const RWG_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.space.iflow.randomwallpaper';
const RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.backend-connection';

const LoggerModule = Self.imports.logger;

function init(metaData) {
	//Convenience.initTranslations();
}

// https://gjs.guide/extensions/overview/anatomy.html#prefs-js
// The code in prefs.js will be executed in a separate Gtk process
// Here you will not have access to code running in GNOME Shell, but fatal errors or mistakes will be contained within that process.
// In this process you will be using the Gtk toolkit, not Clutter.

// https://gjs.guide/extensions/development/preferences.html#preferences-window
// Gnome 42+
function fillPreferencesWindow(window) {
	new RandomWallpaperSettings(window);
}

// 40 < Gnome < 42
// function buildPrefsWidget() {
// 	let window = new Adw.PreferencesWindow();
// 	new RandomWallpaperSettings(window);
// 	return window;
// }

/* UI Setup */
var RandomWallpaperSettings = class {
	_backendConnection = null;

	constructor(window) {
		this.logger = new LoggerModule.Logger('RWG3', 'RandomWallpaper.Settings');

		this._sources = [];
		this.available_rows = {};

		this._settings = ExtensionUtils.getSettings(RWG_SETTINGS_SCHEMA);
		this._backendConnection = new Settings.Settings(RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);
		this._backendConnection.set('pause-timer', 'boolean', true);

		this._builder = new Gtk.Builder();
		//this._builder.set_translation_domain(Self.metadata['gettext-domain']);
		this._builder.add_from_file(Self.path + '/ui/pageGeneral.ui');
		this._builder.add_from_file(Self.path + '/ui/pageSources.ui');

		this._loadSources();

		this._settings.bind('history-length',
			this._builder.get_object('history_length'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('minutes',
			this._builder.get_object('duration_minutes'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('hours',
			this._builder.get_object('duration_hours'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('auto-fetch',
			this._builder.get_object('af_switch'),
			'enable-expansion',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('change-lock-screen',
			this._builder.get_object('change_lock_screen'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('disable-hover-preview',
			this._builder.get_object('disable_hover_preview'),
			'active',
			Gio.SettingsBindFlags.DEFAULT)
		this._settings.bind('hide-panel-icon',
			this._builder.get_object('hide_panel_icon'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('fetch-on-startup',
			this._builder.get_object('fetch_on_startup'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._bindButtons();

		window.connect('close-request', () => {
			this._saveSources();
			this._backendConnection.set('pause-timer', 'boolean', false);
		});

		window.add(this._builder.get_object('page_general'));
		window.add(this._builder.get_object('page_sources'));

		this._sources.forEach(source => {
			let new_row = new SourceRow.SourceRow(source);
			this._builder.get_object('sources_list').add(new_row);
			this.available_rows[new_row.id] = new_row;

			this._bindSourceRow(new_row);
		});
	}

	_bindButtons() {
		let newWallpaperButton = this._builder.get_object('request_new_wallpaper');
		let origNewWallpaperText = newWallpaperButton.get_child().get_label();
		newWallpaperButton.connect('activated', () => {
			newWallpaperButton.get_child().set_label("Loading ...");
			newWallpaperButton.set_sensitive(false);

			// The backend sets this back to false after fetching the image - listen for that event.
			let handler = this._backendConnection.observe('request-new-wallpaper', () => {
				if (!this._backendConnection.get('request-new-wallpaper', 'boolean')) {
					newWallpaperButton.get_child().set_label(origNewWallpaperText);
					newWallpaperButton.set_sensitive(true);
					this._backendConnection.disconnect(handler);
				}
			});

			this._backendConnection.set('request-new-wallpaper', 'boolean', true);
		});

		this._builder.get_object('clear_history').connect('clicked', () => {
			this._backendConnection.set('clear-history', 'boolean', true);
		});

		this._builder.get_object('open_wallpaper_folder').connect('clicked', () => {
			this._backendConnection.set('open-folder', 'boolean', true);
		});

		this._builder.get_object('button_new_source').connect('clicked', () => {
			let source_row = new SourceRow.SourceRow();
			this.available_rows[source_row.id] = source_row;
			this._builder.get_object('sources_list').add(source_row);

			this._bindSourceRow(source_row);
		});
	}

	_bindSourceRow(source_row) {
		source_row.connect('notify::expanded', (row) => {
			if (!row.expanded) {
				this._saveSources();
			}
		});

		source_row.connect('notify::enable-expansion', () => {
			this._saveSources();
		});

		source_row.button_delete.connect('clicked', () => {
			this._builder.get_object('sources_list').remove(source_row);
			delete this.available_rows[source_row.id];
			this._saveSources();
		});

		source_row.combo.connect('notify::selected', () => {
			this._saveSources();
		});
	}

	/**
	 * Load the config from the gschema
	 */
	_loadSources() {
		let stringSources = this._settings.get_strv('sources');
		this._sources = stringSources.map(elem => {
			return JSON.parse(elem)
		});

		this._sources.sort((a, b) => {
			return a.type - b.type;
		});
	}

	/**
	 * Save the config to the gschema
	 */
	_saveSources() {
		this._sources = [];

		for (const row in this.available_rows) {
			if (Object.hasOwnProperty.call(this.available_rows, row)) {
				const element = this.available_rows[row];
				this._sources.push({
					id: element.id,
					type: element.combo.get_selected(),
					enabled: element.get_enable_expansion()
				});
			}
		}

		let stringSources = this._sources.map(elem => {
			return JSON.stringify(elem)
		});
		this._settings.set_strv('sources', stringSources);
		Gio.Settings.sync();
	}
};
