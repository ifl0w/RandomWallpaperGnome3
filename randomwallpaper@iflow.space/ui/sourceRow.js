const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Self = ExtensionUtils.getCurrentExtension();
const Settings = Self.imports.settings;
const Utils = Self.imports.utils;

const GenericJson = Self.imports.ui.genericJson;
const LocalFolder = Self.imports.ui.localFolder;
const Reddit = Self.imports.ui.reddit;
const Unsplash = Self.imports.ui.unsplash;
const UrlSource = Self.imports.ui.urlSource;
const Wallhaven = Self.imports.ui.wallhaven;

// https://gitlab.gnome.org/GNOME/gjs/-/blob/master/examples/gtk4-template.js
var SourceRow = GObject.registerClass({
	GTypeName: 'SourceRow',
	Template: GLib.filename_to_uri(Self.path + '/ui/sourceRow.ui', null),
	Children: [
		'button_delete'
	],
	InternalChildren: [
		'blocked_images_list',
		'combo',
		'settings_container',
		'source_name'
	]
}, class SourceRow extends Adw.ExpanderRow {
	// This list is the same across all rows
	static _stringList = null;

	constructor(id = null, params = {}) {
		super(params);

		if (id === null) {
			// New row
			this.id = Date.now();
		} else {
			this.id = id;
		}

		const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${this.id}/`;
		this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);

		if (this._stringList === null || this._stringList === undefined) {
			// Fill combo from settings enum

			let availableTypes = this._settings.getSchema().get_key('type').get_range(); //GLib.Variant (sv)
			// (sv) = Tuple(%G_VARIANT_TYPE_STRING, %G_VARIANT_TYPE_VARIANT)
			// s should be 'enum'
			// v should be an array enumerating the possible values. Each item in the array is a possible valid value and no other values are valid.
			// v is 'as'
			availableTypes = availableTypes.get_child_value(1).get_variant().get_strv();

			this._stringList = Gtk.StringList.new(availableTypes);
		}
		this._combo.model = this._stringList;
		this._combo.selected = this._settings.get('type', 'enum');

		this._settings.bind('name',
			this._source_name,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('enabled',
			this,
			'enable-expansion',
			Gio.SettingsBindFlags.DEFAULT);
		// Binding an enum isn't possible straight away.
		// This would need bind_with_mapping() which isn't available in gjs?
		// this._settings.bind('type',
		// 	this._combo,
		// 	'selected',
		// 	Gio.SettingsBindFlags.DEFAULT);

		this._combo.connect('notify::selected', comboRow => {
			this._settings.set('type', 'enum', comboRow.selected);
			this._fillRow(comboRow.selected);
		});

		this._fillRow(this._combo.selected);

		let blockedImages = this._settings.get('blocked-images', 'strv');
		blockedImages.forEach(filename => {
			let blockedImageRow = new Adw.ActionRow();
			blockedImageRow.set_title(filename);

			let button = new Gtk.Button();
			button.set_valign(Gtk.Align.CENTER);
			button.connect('clicked', () => {
				this._removeBlockedImage(filename);
				this._blocked_images_list.remove(blockedImageRow);
			});

			let buttonContent = new Adw.ButtonContent();
			buttonContent.set_icon_name("user-trash-symbolic")

			button.set_child(buttonContent);
			blockedImageRow.add_suffix(button);
			this._blocked_images_list.add_row(blockedImageRow);
			this._blocked_images_list.set_sensitive(true);
		});
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

	_removeBlockedImage(filename) {
		let blockedImages = this._settings.get('blocked-images', 'strv');
		if (!blockedImages.includes(filename)) {
			return;
		}

		blockedImages = Utils.Utils.removeItemOnce(blockedImages, filename);
		this._settings.set('blocked-images', 'strv', blockedImages);
	}

	clearConfig() {
		for (const i of Array(6).keys()) {
			let widget = this._getSettingsGroup(i);
			widget.clearConfig();
		}

		this._settings.reset('blocked-images');
		this._settings.reset('enabled');
		this._settings.reset('name');
		this._settings.reset('type');
	}
});
