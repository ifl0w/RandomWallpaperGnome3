import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Settings from './../settings.js';

// Generated code produces a no-shadow rule error
/* eslint-disable */
enum ConstraintType {
    UNCONSTRAINED,
    USER,
    USERS_LIKES,
    COLLECTION_ID,
}
/* eslint-enable */

// FIXME: Generated static class code produces a no-unused-expressions rule error
/* eslint-disable no-unused-expressions */

/**
 * Subclass containing the preferences group for Unsplash adapter
 */
class UnsplashSettingsGroup extends Adw.PreferencesGroup {
    static [GObject.GTypeName] = 'UnsplashSettingsGroup';
    // @ts-expect-error Gtk.template is not in the type definitions files yet
    static [Gtk.template] = GLib.uri_resolve_relative(import.meta.url, './unsplash.ui', GLib.UriFlags.NONE);
    // @ts-expect-error Gtk.internalChildren is not in the type definitions files yet
    static [Gtk.internalChildren] = [
        'constraint_type',
        'constraint_value',
        'featured_only',
        'image_height',
        'image_width',
        'keyword',
    ];

    // InternalChildren
    private _constraint_type!: Adw.ComboRow;
    private _constraint_value!: Adw.EntryRow;
    private _featured_only!: Gtk.Switch;
    private _image_height!: Gtk.Adjustment;
    private _image_width!: Gtk.Adjustment;
    private _keyword!: Adw.EntryRow;

    static {
        GObject.registerClass(this);
    }

    // This list is the same across all rows
    static _stringList: Gtk.StringList;

    private _settings;

    /**
     * Craft a new adapter using an unique ID.
     *
     * Previously saved settings will be used if the adapter and ID match.
     *
     * @param {string} id Unique ID
     */
    constructor(id: string) {
        super(undefined);

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
}

/**
 * Retrieve the human readable enum name.
 *
 * @param {ConstraintType} type The type to name
 * @returns {string} Name
 */
function _getConstraintTypeName(type: ConstraintType): string {
    let name: string;

    switch (type) {
    case ConstraintType.UNCONSTRAINED:
        name = 'Unconstrained';
        break;
    case ConstraintType.USER:
        name = 'User';
        break;
    case ConstraintType.USERS_LIKES:
        name = 'User\'s Likes';
        break;
    case ConstraintType.COLLECTION_ID:
        name = 'Collection ID';
        break;

    default:
        name = 'Constraint type name not found';
        break;
    }

    return name;
}

/**
 * Get a list of human readable enum entries.
 *
 * @returns {string[]} Array with key names
 */
function getConstraintTypeNameList(): string[] {
    const list: string[] = [];

    const values = Object.values(ConstraintType).filter(v => !isNaN(Number(v)));
    for (const i of values)
        list.push(_getConstraintTypeName(i as ConstraintType));

    return list;
}

export {UnsplashSettingsGroup};
