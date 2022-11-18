const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.genericJSON';

var GenericJsonSettingsGroup = GObject.registerClass({
	GTypeName: 'GenericJsonSettingsGroup',
	Template: GLib.filename_to_uri(Self.path + '/ui/genericJson.ui', null),
	InternalChildren: [
		'author_name_path',
		'author_url_path',
		'author_url_prefix',
		'domain',
		'image_path',
		'image_prefix',
		'post_path',
		'post_prefix',
		'request_url'
	]
}, class GenericJsonSettingsGroup extends Adw.PreferencesGroup {
	constructor(id, params = {}) {
		super(params);

		const path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/genericJSON/${id}/`;
		this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON, path);

		this._settings.bind('domain',
			this._domain,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('request-url',
			this._request_url,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('image-path',
			this._image_path,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('image-prefix',
			this._image_prefix,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('post-path',
			this._post_path,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('post-prefix',
			this._post_prefix,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('author-name-path',
			this._author_name_path,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('author-url-path',
			this._author_url_path,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('author-url-prefix',
			this._author_url_prefix,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
	}

	clearConfig() {
		this._settings.reset('domain');
		this._settings.reset('request-url');
		this._settings.reset('image-path');
		this._settings.reset('image-prefix');
		this._settings.reset('post-path');
		this._settings.reset('post-prefix');
		this._settings.reset('author-name-path');
		this._settings.reset('author-url-path');
		this._settings.reset('author-url-prefix');
	}
});
