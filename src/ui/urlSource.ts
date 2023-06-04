import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

// Legacy importing style for shell internal bindings not available in standard import format
const ExtensionUtils = imports.misc.extensionUtils;

import * as Settings from './../settings.js';

const Self = ExtensionUtils.getCurrentExtension();

const UrlSourceSettingsGroup = GObject.registerClass({
    GTypeName: 'UrlSourceSettingsGroup',
    Template: GLib.filename_to_uri(`${Self.path}/ui/urlSource.ui`, null),
    InternalChildren: [
        'author_name',
        'author_url',
        'different_images',
        'domain',
        'image_url',
        'post_url',
    ],
}, class UrlSourceSettingsGroup extends Adw.PreferencesGroup {
    // InternalChildren
    private _author_name!: Adw.EntryRow;
    private _author_url!: Adw.EntryRow;
    private _different_images!: Gtk.Switch;
    private _domain!: Adw.EntryRow;
    private _image_url!: Adw.EntryRow;
    private _post_url!: Adw.EntryRow;

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

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/urlSource/${id}/`;
        this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE, path);

        this._settings.bind('author-name',
            this._author_name,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('author-url',
            this._author_url,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('different-images',
            this._different_images,
            'active',
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

    /**
     * Clear all config options associated to this specific adapter.
     */
    clearConfig(): void {
        this._settings.resetSchema();
    }
});

export {UrlSourceSettingsGroup};
