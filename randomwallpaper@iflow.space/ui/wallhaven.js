const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const RWG_SETTINGS_SCHEMA_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.wallhaven';

var WallhavenSettingsGroup = GObject.registerClass({
	GTypeName: 'WallhavenSettingsGroup',
	Template: GLib.filename_to_uri(Self.path + '/ui/wallhaven.ui', null),
	InternalChildren: [
		'allow_sfw',
		'allow_sketchy',
		'allow_nsfw',
		'api_key',
		'category_anime',
		'category_general',
		'category_people',
		'keyword',
		'resolutions'
	]
}, class WallhavenSettingsGroup extends Adw.PreferencesGroup {
	constructor(parent_row, params = {}) {
		super(params);

		const path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/wallhaven/${parent_row.id}/`;
		this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_WALLHAVEN, path);

		this._settings.bind('name',
			parent_row.source_name,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('keyword',
			this._keyword,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('api-key',
			this._api_key,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('resolutions',
			this._resolutions,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('category-general',
			this._category_general,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('category-anime',
			this._category_anime,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('category-people',
			this._category_people,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('allow-sfw',
			this._allow_sfw,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('allow-sketchy',
			this._allow_sketchy,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('allow-nsfw',
			this._allow_nsfw,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
	}
});
