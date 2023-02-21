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

// https://gitlab.gnome.org/GNOME/gjs/-/blob/master/examples/gtk4-template.js
var SourceRow = GObject.registerClass({
	GTypeName: 'SourceRow',
	Template: GLib.filename_to_uri(Self.path + '/ui/sourceRow.ui', null),
	Children: [
		'button_delete',
		'combo',
		'source_name'
	],
	InternalChildren: [
		'settings_container'
	]
}, class SourceRow extends Adw.ExpanderRow {
	constructor(configObject = null, params = {}) {
		super(params);

		if (configObject === null) {
			// New row
			this.id = Date.now();
			this.combo.set_selected(0);
			this.set_enable_expansion(true);
			this._settings_container.set_child(new Unsplash.UnsplashSettingsGroup(this));
		} else {
			// Row from config
			this.id = configObject.id;
			this.combo.set_selected(configObject.type);
			this.set_enable_expansion(configObject.enabled);

			this._fillRow(this.combo.selected);
		}

		this.combo.connect('notify::selected', comboRow => {
			this._clearConfig()
			this._fillRow(comboRow.selected);
		});
	}

	_clearConfig() {
		// TODO: clear remainder?
		// this._settings_container.get_child().unbind(this);
		Gio.Settings.unbind(this.source_name, 'text');
	}

	_fillRow(type) {
		let targetWidget = null;
		switch (type) {
			case 0: // unsplash
				targetWidget = new Unsplash.UnsplashSettingsGroup(this);
				break;
			case 1: // wallhaven
				targetWidget = new Wallhaven.WallhavenSettingsGroup(this);
				break;
			case 2: // reddit
				targetWidget = new Reddit.RedditSettingsGroup(this);
				break;
			case 3: // generic JSON
				targetWidget = new GenericJson.GenericJsonSettingsGroup(this);
				break;
			case 4: // Local Folder
				targetWidget = new LocalFolder.LocalFolderSettingsGroup(this);
				break;
			default:
				targetWidget = null;
				this.logger.error("The selected source has no corresponding widget!")
				break;
		}

		if (targetWidget !== null) {
			this._settings_container.set_child(targetWidget);
		}
	}
});
