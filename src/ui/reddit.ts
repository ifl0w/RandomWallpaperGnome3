import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

// Legacy importing style for shell internal bindings not available in standard import format
const ExtensionUtils = imports.misc.extensionUtils;

import * as Settings from './../settings.js';

const Self = ExtensionUtils.getCurrentExtension();

const RedditSettingsGroup = GObject.registerClass({
    GTypeName: 'RedditSettingsGroup',
    Template: GLib.filename_to_uri(`${Self.path}/ui/reddit.ui`, null),
    InternalChildren: [
        'allow_sfw',
        'image_ratio1',
        'image_ratio2',
        'min_height',
        'min_width',
        'subreddits',
    ],
}, class RedditSettingsGroup extends Adw.PreferencesGroup {
    // InternalChildren
    private _allow_sfw!: Gtk.Switch;
    private _image_ratio1!: Gtk.Adjustment;
    private _image_ratio2!: Gtk.Adjustment;
    private _min_height!: Gtk.Adjustment;
    private _min_width!: Gtk.Adjustment;
    private _subreddits!: Adw.EntryRow;

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

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/reddit/${id}/`;
        this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_REDDIT, path);

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

    /**
     * Clear all config options associated to this specific adapter.
     */
    clearConfig(): void {
        this._settings.resetSchema();
    }
});

export {RedditSettingsGroup};
