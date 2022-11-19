const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const RWG_SETTINGS_SCHEMA_SOURCES_REDDIT = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.reddit';

var RedditSettingsGroup = GObject.registerClass({
	GTypeName: 'RedditSettingsGroup',
	Template: GLib.filename_to_uri(Self.path + '/ui/reddit.ui', null),
	InternalChildren: [
		'allow_sfw',
		'image_ratio1',
		'image_ratio2',
		'min_height',
		'min_width',
		'subreddits'
	]
}, class RedditSettingsGroup extends Adw.PreferencesGroup {
	constructor(id, params = {}) {
		super(params);

		const path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/reddit/${id}/`;
		this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_SOURCES_REDDIT, path);

		this._settings.bind('allow-sfw',
			this._allow_sfw,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('image-ratio1',
			this._image_ratio1,
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('image-ratio2',
			this._image_ratio2,
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('min-height',
			this._min_height,
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('min-width',
			this._min_width,
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('subreddits',
			this._subreddits,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
	}

	clearConfig() {
		this._settings.reset('allow-sfw');
		this._settings.reset('min-height');
		this._settings.reset('min-width');
		this._settings.reset('image-ratio1');
		this._settings.reset('image-ratio2');
		this._settings.reset('subreddits');
	}
});
