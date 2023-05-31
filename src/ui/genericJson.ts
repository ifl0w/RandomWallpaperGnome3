import * as Adw from '@gi-types/adw1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as AdwEntryRow from '@gi/gtk4/adw/adwEntryRow';
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
    private _author_name_path!: AdwEntryRow.EntryRow;
    private _author_url_path!: AdwEntryRow.EntryRow;
    private _author_url_prefix!: AdwEntryRow.EntryRow;
    private _domain!: AdwEntryRow.EntryRow;
    private _image_path!: AdwEntryRow.EntryRow;
    private _image_prefix!: AdwEntryRow.EntryRow;
    private _post_path!: AdwEntryRow.EntryRow;
    private _post_prefix!: AdwEntryRow.EntryRow;
    private _request_url!: AdwEntryRow.EntryRow;

    private _settings;

    constructor(params: Partial<Adw.PreferencesGroup.ConstructorProperties> | undefined, id: string) {
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

    clearConfig(): void {
        this._settings.resetSchema();
    }
});

export {GenericJsonSettingsGroup};
