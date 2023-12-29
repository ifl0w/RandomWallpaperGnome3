import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Settings from './../settings.js';

// FIXME: Generated static class code produces a no-unused-expressions rule error
/* eslint-disable no-unused-expressions */

/**
 * Subclass containing the preferences for Wallhaven adapter
 */
class WallhavenSettings extends Adw.PreferencesPage {
    static [GObject.GTypeName] = 'WallhavenSettings';
    // @ts-expect-error Gtk.template is not in the type definitions files yet
    static [Gtk.template] = GLib.uri_resolve_relative(import.meta.url, './wallhaven.ui', GLib.UriFlags.NONE);
    // @ts-expect-error Gtk.internalChildren is not in the type definitions files yet
    static [Gtk.internalChildren] = [
        'ai_art',
        'allow_nsfw',
        'allow_sfw',
        'allow_sketchy',
        'api_key',
        'aspect_ratios',
        'button_color_undo',
        'button_color',
        'category_anime',
        'category_general',
        'category_people',
        'keyword',
        'minimal_resolution',
        'row_color',
    ];

    static {
        GObject.registerClass(this);
    }

    private static _colorPalette: Gdk.RGBA[];
    private static _availableColors: string[] = [
        '#660000', '#990000', '#cc0000', '#cc3333', '#ea4c88',
        '#993399', '#663399', '#333399', '#0066cc', '#0099cc',
        '#66cccc', '#77cc33', '#669900', '#336600', '#666600',
        '#999900', '#cccc33', '#ffff00', '#ffcc33', '#ff9900',
        '#ff6600', '#cc6633', '#996633', '#663300', '#000000',
        '#999999', '#cccccc', '#ffffff', '#424153',
    ];

    // InternalChildren
    private _ai_art!: Gtk.Switch;
    private _allow_nsfw!: Gtk.Switch;
    private _allow_sfw!: Gtk.Switch;
    private _allow_sketchy!: Gtk.Switch;
    private _api_key!: Adw.EntryRow;
    private _aspect_ratios!: Adw.EntryRow;
    private _button_color_undo!: Gtk.Button;
    private _button_color!: Gtk.Button;
    private _category_anime!: Gtk.Switch;
    private _category_general!: Gtk.Switch;
    private _category_people!: Gtk.Switch;
    private _keyword!: Adw.EntryRow;
    private _minimal_resolution!: Adw.EntryRow;
    private _row_color!: Adw.ActionRow;

    private _colorDialog: Gtk.ColorChooserDialog | undefined;
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

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/wallhaven/${id}/`;
        this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN, path);

        this._settings.bind('ai-art',
            this._ai_art,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('allow-nsfw',
            this._allow_nsfw,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('allow-sfw',
            this._allow_sfw,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('allow-sketchy',
            this._allow_sketchy,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('api-key',
            this._api_key,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('category-anime',
            this._category_anime,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('category-general',
            this._category_general,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('category-people',
            this._category_people,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('color',
            this._row_color,
            'subtitle',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('keyword',
            this._keyword,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('minimal-resolution',
            this._minimal_resolution,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('aspect-ratios',
            this._aspect_ratios,
            'text',
            Gio.SettingsBindFlags.DEFAULT);

        this._button_color_undo.connect('clicked', () => {
            this._row_color.subtitle = '';
        });

        this._button_color.connect('clicked', () => {
            // TODO: For GTK 4.10+
            // Gtk.ColorDialog();

            // https://stackoverflow.com/a/54487948
            this._colorDialog = new Gtk.ColorChooserDialog({
                title: 'Choose a Color',
                transient_for: this.get_root() as Gtk.Window ?? undefined,
                modal: true,
            });
            this._colorDialog.set_use_alpha(false);

            if (!WallhavenSettings._colorPalette) {
                WallhavenSettings._colorPalette = [];

                WallhavenSettings._availableColors.forEach(hexColor => {
                    const rgbaColor = new Gdk.RGBA();
                    rgbaColor.parse(hexColor);
                    WallhavenSettings._colorPalette.push(rgbaColor);
                });
            }
            this._colorDialog.add_palette(Gtk.Orientation.HORIZONTAL, 10, WallhavenSettings._colorPalette);

            this._colorDialog.connect('response', (dialog: Gtk.ColorChooserDialog, response_id: Gtk.ResponseType) => {
                if (response_id === Gtk.ResponseType.OK) {
                    // result is a Gdk.RGBA which uses float
                    const rgba = dialog.get_rgba();
                    // convert to rgba so it's useful
                    const rgbaString = rgba.to_string() ?? 'rgb(0,0,0)';
                    const rgbaArray = rgbaString.replace('rgb(', '').replace(')', '').split(',');
                    const hexString = `${parseInt(rgbaArray[0]).toString(16).padStart(2, '0')}${parseInt(rgbaArray[1]).toString(16).padStart(2, '0')}${parseInt(rgbaArray[2]).toString(16).padStart(2, '0')}`;
                    this._row_color.subtitle = hexString;
                }
                dialog.destroy();
            });

            this._colorDialog.show();
        });
    }

    /**
     * Clear all config options associated to this specific adapter.
     */
    clearConfig(): void {
        this._settings.resetSchema();
    }
}

export {WallhavenSettings};
