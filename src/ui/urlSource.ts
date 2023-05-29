import * as Adw from '@gi-types/adw1';
import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';
import * as GObject from 'gi://GObject';
import * as Gtk from 'gi://Gtk?version=4.0';

import * as AdwEntryRow from '@gi/gtk4/adw/adwEntryRow';
import * as ExtensionUtils from '@gi/misc/extensionUtils';

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
    private _author_name!: AdwEntryRow.EntryRow;
    private _author_url!: AdwEntryRow.EntryRow;
    private _different_images!: Gtk.Switch;
    private _domain!: AdwEntryRow.EntryRow;
    private _image_url!: AdwEntryRow.EntryRow;
    private _post_url!: AdwEntryRow.EntryRow;

    private _settings;

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

    clearConfig(): void {
        this._settings.resetSchema();
    }
});

export {UrlSourceSettingsGroup};
