const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const Unsplash = Self.imports.ui.unsplash;
const Wallhaven = Self.imports.ui.wallhaven;
const Reddit = Self.imports.ui.reddit;
const GenericJson = Self.imports.ui.genericJson;
const LocalFolder = Self.imports.ui.localFolder;
const UrlSource = Self.imports.ui.urlSource;

const RWG_SETTINGS_SCHEMA_SOURCES_GENERAL = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.general';

// https://gitlab.gnome.org/GNOME/gjs/-/blob/master/examples/gtk4-template.js
var SourceRow = GObject.registerClass({
	GTypeName: 'SourceRow',
	Template: GLib.filename_to_uri(Self.path + '/ui/sourceRow.ui', null),
	Children: [
		'button_delete'
	],
	InternalChildren: [
		'combo',
		'settings_container',
		'source_name'
	]
}, class SourceRow extends Adw.ExpanderRow {
	constructor(id = null, params = {}) {
		super(params);

		if (id === null) {
			// New row
			this.id = Date.now();
		} else {
			this.id = id;
		}

		const path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/general/${this.id}/`;
		this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);

		this._settings.bind('name',
			this._source_name,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('enabled',
			this,
			'enable-expansion',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('type',
			this._combo,
			'selected',
			Gio.SettingsBindFlags.DEFAULT);

		this._combo.connect('notify::selected', comboRow => {
			this._fillRow(comboRow.selected);
		});

		this._fillRow(this._combo.selected);
	}

	_fillRow(type) {
		let targetWidget = this._getSettingsGroup(type);
		if (targetWidget !== null) {
			this._settings_container.set_child(targetWidget);
		}
	}

	_getSettingsGroup(type = 0) {
		let targetWidget;
		switch (type) {
			case 0: // unsplash
				targetWidget = new Unsplash.UnsplashSettingsGroup(this.id);
				break;
			case 1: // wallhaven
				targetWidget = new Wallhaven.WallhavenSettingsGroup(this.id);
				break;
			case 2: // reddit
				targetWidget = new Reddit.RedditSettingsGroup(this.id);
				break;
			case 3: // generic JSON
				targetWidget = new GenericJson.GenericJsonSettingsGroup(this.id);
				break;
			case 4: // Local Folder
				targetWidget = new LocalFolder.LocalFolderSettingsGroup(this.id);
				break;
			case 5: // Static URL
				targetWidget = new UrlSource.UrlSourceSettingsGroup(this.id);
				break;
			default:
				targetWidget = null;
				this.logger.error("The selected source has no corresponding widget!")
				break;
		}
		return targetWidget;
	}

	clearConfig() {
		for (const i of Array(6).keys()) {
			let widget = this._getSettingsGroup(i);
			widget.clearConfig();
		}

		this._settings.reset('name');
		this._settings.reset('enabled');
		this._settings.reset('type');
	}
});
