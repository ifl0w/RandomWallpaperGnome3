const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.unsplash';

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
	constructor(id, params = {}) {
		super(params);

		const path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/unsplash/${id}/`;
		this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH, path);

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
		this._settings.bind('constraint-type',
			this._constraint_type,
			'selected',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('constraint-value',
			this._constraint_value,
			'text',
			Gio.SettingsBindFlags.DEFAULT);

		this._unsplashUnconstrained(this._constraint_type, true, this._featured_only);
		this._unsplashUnconstrained(this._constraint_type, false, this._constraint_value);
		this._constraint_type.connect('notify::selected', (comboRow) => {
			this._unsplashUnconstrained(comboRow, true, this._featured_only);
			this._unsplashUnconstrained(comboRow, false, this._constraint_value);

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
});
