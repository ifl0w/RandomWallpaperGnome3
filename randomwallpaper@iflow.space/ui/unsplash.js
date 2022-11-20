const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Self = ExtensionUtils.getCurrentExtension();
const Settings = Self.imports.settings;

var UnsplashSettingsGroup = GObject.registerClass({
	GTypeName: 'UnsplashSettingsGroup',
	Template: GLib.filename_to_uri(Self.path + '/ui/unsplash.ui', null),
	InternalChildren: [
		'constraint_type',
		'constraint_value',
		'featured_only',
		'image_height',
		'image_width',
		'keyword'
	]
}, class UnsplashSettingsGroup extends Adw.PreferencesGroup {
	// This list is the same across all rows
	static _stringList = null;

	constructor(id, params = {}) {
		super(params);

		const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/unsplash/${id}/`;
		this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH, path);

		if (this._stringList === null || this._stringList === undefined) {
			// Fill combo from settings enum

			let availableTypes = this._settings.getSchema().get_key('constraint-type').get_range(); //GLib.Variant (sv)
			// (sv) = Tuple(%G_VARIANT_TYPE_STRING, %G_VARIANT_TYPE_VARIANT)
			// s should be 'enum'
			// v should be an array enumerating the possible values. Each item in the array is a possible valid value and no other values are valid.
			// v is 'as'
			availableTypes = availableTypes.get_child_value(1).get_variant().get_strv();

			this._stringList = Gtk.StringList.new(availableTypes);
		}

		this._constraint_type.model = this._stringList;
		this._constraint_type.selected = this._settings.get('constraint-type', 'enum');

		this._settings.bind('keyword',
			this._keyword,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('image-width',
			this._image_width,
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('image-height',
			this._image_height,
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('featured-only',
			this._featured_only,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		// Binding an enum isn't possible straight away.
		// This would need bind_with_mapping() which isn't available in gjs?
		// this._settings.bind('constraint-type',
		// 	this._constraint_type,
		// 	'selected',
		// 	Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('constraint-value',
			this._constraint_value,
			'text',
			Gio.SettingsBindFlags.DEFAULT);

		this._unsplashUnconstrained(this._constraint_type, true, this._featured_only);
		this._unsplashUnconstrained(this._constraint_type, false, this._constraint_value);
		this._constraint_type.connect('notify::selected', (comboRow) => {
			this._unsplashUnconstrained(comboRow, true, this._featured_only);
			this._unsplashUnconstrained(comboRow, false, this._constraint_value);
			this._settings.set('constraint-type', 'enum', comboRow.selected);

			this._featured_only.set_active(false);
		});
	}

	_unsplashUnconstrained(comboRow, enable, targetElement) {
		if (comboRow.selected === 0) {
			targetElement.set_sensitive(enable);
		} else {
			targetElement.set_sensitive(!enable);
		}
	}

	clearConfig() {
		this._settings.reset('keyword');
		this._settings.reset('image-width');
		this._settings.reset('image-height');
		this._settings.reset('featured-only');
		this._settings.reset('constraint-type');
		this._settings.reset('constraint-value');
	}
});
