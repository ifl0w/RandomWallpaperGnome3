import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Settings from './../settings.js';

const GenericJsonSettingsGroup = GObject.registerClass({
    GTypeName: 'GenericJsonSettingsGroup',
    Template: GLib.uri_resolve_relative(import.meta.url, './genericJson.ui', GLib.UriFlags.NONE),
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

    /**
     * Craft a new adapter using an unique ID.
     *
     * Previously saved settings will be used if the adapter and ID match.
     *
     * @param {Partial<Adw.PreferencesGroup.ConstructorProperties> | undefined} params Properties for Adw.PreferencesGroup or undefined
     * @param {string} id Unique ID
     */
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

    /**
     * Clear all config options associated to this specific adapter.
     */
    clearConfig(): void {
        this._settings.resetSchema();
    }
});

export {GenericJsonSettingsGroup};
