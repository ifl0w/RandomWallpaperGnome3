import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';
import * as GObject from 'gi://GObject';

import * as Adw from '@gi/gtk4/adw/adw';
import * as ExtensionUtils from '@gi/misc/extensionUtils';

import * as Settings from './../settings.js';

const Self = ExtensionUtils.getCurrentExtension();

const GenericJsonSettingsGroup = GObject.registerClass({
    GTypeName: 'GenericJsonSettingsGroup',
    Template: GLib.filename_to_uri(`${Self.path}/ui/genericJson.ui`, null),
    InternalChildren: [
        'author_name_path',
        'author_url_path',
        'author_url_prefix',
        'domain',
        'image_path',
        'image_prefix',
        'post_path',
        'post_prefix',
        'request_url',
    ],
}, class GenericJsonSettingsGroup extends Adw.PreferencesGroup {
    // InternalChildren
    private _author_name_path!: Adw.EntryRow;
    private _author_url_path!: Adw.EntryRow;
    private _author_url_prefix!: Adw.EntryRow;
    private _domain!: Adw.EntryRow;
    private _image_path!: Adw.EntryRow;
    private _image_prefix!: Adw.EntryRow;
    private _post_path!: Adw.EntryRow;
    private _post_prefix!: Adw.EntryRow;
    private _request_url!: Adw.EntryRow;

    private _settings;

    constructor(params: any | undefined, id: string) {
        super(params);

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/genericJSON/${id}/`;
        this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON, path);

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
        this._settings.reset('author-name-path');
        this._settings.reset('author-url-path');
        this._settings.reset('author-url-prefix');
        this._settings.reset('domain');
        this._settings.reset('image-path');
        this._settings.reset('image-prefix');
        this._settings.reset('post-path');
        this._settings.reset('post-prefix');
        this._settings.reset('request-url');
    }
});

export {GenericJsonSettingsGroup};
