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
		this._settings.bind('subreddits',
			this._subreddits,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
	}
});
