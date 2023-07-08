import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

// Legacy importing style for shell internal bindings not available in standard import format
const ExtensionUtils = imports.misc.extensionUtils;

import * as Settings from './../settings.js';
import {getConstraintTypeNameList} from '../adapter/unsplash.js';

const Self = ExtensionUtils.getCurrentExtension();

const UnsplashSettingsGroup = GObject.registerClass({
    GTypeName: 'UnsplashSettingsGroup',
    Template: GLib.filename_to_uri(`${Self.path}/ui/unsplash.ui`, null),
    InternalChildren: [
        'constraint_type',
        'constraint_value',
        'featured_only',
        'image_height',
        'image_width',
        'keyword',
    ],
}, class UnsplashSettingsGroup extends Adw.PreferencesGroup {
    // This list is the same across all rows
    static _stringList: Gtk.StringList;

    // InternalChildren
    private _constraint_type!: Adw.ComboRow;
    private _constraint_value!: Adw.EntryRow;
    private _featured_only!: Gtk.Switch;
    private _image_height!: Gtk.Adjustment;
    private _image_width!: Gtk.Adjustment;
    private _keyword!: Adw.EntryRow;

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

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/unsplash/${id}/`;
        this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH, path);

        if (!UnsplashSettingsGroup._stringList)
            UnsplashSettingsGroup._stringList = Gtk.StringList.new(getConstraintTypeNameList());

        this._constraint_type.model = UnsplashSettingsGroup._stringList;

        this._settings.bind('constraint-type',
            this._constraint_type,
            'selected',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('constraint-value',
            this._constraint_value,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('featured-only',
            this._featured_only,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('image-width',
            this._image_width,
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('image-height',
            this._image_height,
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('keyword',
            this._keyword,
            'text',
            Gio.SettingsBindFlags.DEFAULT);

        this._unsplashUnconstrained(this._constraint_type, true, this._featured_only);
        this._unsplashUnconstrained(this._constraint_type, false, this._constraint_value);
        this._constraint_type.connect('notify::selected', (comboRow: Adw.ComboRow) => {
            this._unsplashUnconstrained(comboRow, true, this._featured_only);
            this._unsplashUnconstrained(comboRow, false, this._constraint_value);

            this._featured_only.set_active(false);
        });
    }

    /**
     * Switch element sensitivity based on a selected combo row entry.
     *
     * @param {Adw.ComboRow} comboRow ComboRow with selected entry
     * @param {boolean} enable Whether to make the element sensitive
     * @param {Gtk.Widget} targetElement The element to target the sensitivity setting
     */
    private _unsplashUnconstrained(comboRow: Adw.ComboRow, enable: boolean, targetElement: Gtk.Widget): void {
        if (comboRow.selected === 0)
            targetElement.set_sensitive(enable);
        else
            targetElement.set_sensitive(!enable);
    }

    /**
     * Clear all config options associated to this specific adapter.
     */
    clearConfig(): void {
        this._settings.resetSchema();
    }
});

export {UnsplashSettingsGroup};
