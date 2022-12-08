import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';
import * as GObject from 'gi://GObject';
import * as Gtk from 'gi://Gtk';

import * as Adw from '@gi/gtk4/adw/adw';
import * as ExtensionUtils from '@gi/misc/extensionUtils';

import * as Settings from './../settings.js';

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

    constructor(params: any | undefined, id: string) {
        super(params);

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/unsplash/${id}/`;
        this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH, path);

        if (!UnsplashSettingsGroup._stringList) {
            // Fill combo from settings enum

            const availableTypes = this._settings.getSchema().get_key('constraint-type').get_range(); // GLib.Variant (sv)
            // (sv) = Tuple(%G_VARIANT_TYPE_STRING, %G_VARIANT_TYPE_VARIANT)
            // s should be 'enum'
            // v should be an array enumerating the possible values. Each item in the array is a possible valid value and no other values are valid.
            // v is 'as'
            const availableTypeNames = availableTypes.get_child_value(1).get_variant().get_strv();

            UnsplashSettingsGroup._stringList = Gtk.StringList.new(availableTypeNames);
        }

        this._constraint_type.model = UnsplashSettingsGroup._stringList;
        this._constraint_type.selected = this._settings.getEnum('constraint-type');

        this._settings.bind('keyword',
            this._keyword,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('image-width',
            this._image_width,
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('image-height',
            this._image_height,
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('featured-only',
            this._featured_only,
            'active',
            Gio.SettingsBindFlags.DEFAULT);

        // Binding an enum isn't possible straight away.
        // This would need bind_with_mapping() which isn't available in gjs?
        this._settings.bind('constraint-value',
            this._constraint_value,
            'text',
            Gio.SettingsBindFlags.DEFAULT);

        this._unsplashUnconstrained(this._constraint_type, true, this._featured_only);
        this._unsplashUnconstrained(this._constraint_type, false, this._constraint_value);
        this._constraint_type.connect('notify::selected', (comboRow: Adw.ComboRow) => {
            this._unsplashUnconstrained(comboRow, true, this._featured_only);
            this._unsplashUnconstrained(comboRow, false, this._constraint_value);
            this._settings.setEnum('constraint-type', comboRow.selected);

            this._featured_only.set_active(false);
        });
    }

    private _unsplashUnconstrained(comboRow: Adw.ComboRow, enable: boolean, targetElement: Gtk.Widget) {
        if (comboRow.selected === 0)
            targetElement.set_sensitive(enable);
        else
            targetElement.set_sensitive(!enable);
    }

    clearConfig() {
        this._settings.reset('constraint-type');
        this._settings.reset('constraint-value');
        this._settings.reset('featured-only');
        this._settings.reset('image-height');
        this._settings.reset('image-width');
        this._settings.reset('keyword');
    }
});

export {UnsplashSettingsGroup};
