const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.urlSource';

var UrlSourceSettingsGroup = GObject.registerClass({
    GTypeName: 'UrlSourceSettingsGroup',
    Template: GLib.filename_to_uri(Self.path + '/ui/urlSource.ui', null),
    InternalChildren: [
        'author_name',
        'author_url',
        'domain',
        'image_url',
        'post_url',
    ]
}, class UrlSourceSettingsGroup extends Adw.PreferencesGroup {
    constructor(id, params = {}) {
        super(params);

        const path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/urlSource/${id}/`;
        this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE, path);

        this._settings.bind('author-name',
            this._author_name,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('author-url',
            this._author_url,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('domain',
            this._domain,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('image-url',
            this._image_url,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('post-url',
            this._post_url,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
    }

    clearConfig() {
        this._settings.reset('author-name');
        this._settings.reset('author-url');
        this._settings.reset('domain');
        this._settings.reset('image-url');
        this._settings.reset('post-url');
    }
});
