import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Settings from './../settings.js';

// FIXME: Generated static class code produces a no-unused-expressions rule error
/* eslint-disable no-unused-expressions */

/**
 * Subclass containing the preferences group for Reddit adapter
 */
class RedditSettingsGroup extends Adw.PreferencesGroup {
    static [GObject.GTypeName] = 'RedditSettingsGroup';
    // @ts-expect-error Gtk.template is not in the type definitions files yet
    static [Gtk.template] = GLib.uri_resolve_relative(import.meta.url, './reddit.ui', GLib.UriFlags.NONE);
    // @ts-expect-error Gtk.internalChildren is not in the type definitions files yet
    static [Gtk.internalChildren] = [
        'allow_sfw',
        'image_ratio1',
        'image_ratio2',
        'min_height',
        'min_width',
        'subreddits',
    ];

    static {
        GObject.registerClass(this);
    }

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
}

export {RedditSettingsGroup};
