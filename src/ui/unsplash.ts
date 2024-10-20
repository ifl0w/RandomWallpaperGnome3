import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Settings from './../settings.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Generated code produces a no-shadow rule error
/* eslint-disable */
// the strings represent the API supported values
enum ContentFilter {
    HIGH = 'high',
    LOW = 'low',
}
// the strings represent the API supported values
enum Orientation {
    LANDSCAPE = 'landscape',
    PORTRAIT = 'portrait',
    SQUARISH = 'squarish',
}
/* eslint-enable */

// FIXME: Generated static class code produces a no-unused-expressions rule error
/* eslint-disable no-unused-expressions */
/**
 * Subclass containing the preferences for Unsplash adapter
 */
class UnsplashSettings extends Adw.PreferencesPage {
    static [GObject.GTypeName] = 'UnsplashSettings';
    // @ts-expect-error Gtk.template is not in the type definitions files yet
    static [Gtk.template] = GLib.uri_resolve_relative(import.meta.url, './unsplash.ui', GLib.UriFlags.NONE);
    // @ts-expect-error Gtk.internalChildren is not in the type definitions files yet
    static [Gtk.internalChildren] = [
        'api_key',
        'query',
        'username',
        'topics',
        'collections',
        'orientation',
        'content_filter',
    ];

    // InternalChildren
    private _collections!: Adw.EntryRow;
    private _topics!: Adw.EntryRow;
    private _username!: Adw.EntryRow;
    private _query!: Adw.EntryRow;
    private _api_key!: Adw.EntryRow;
    private _orientation!: Adw.ComboRow;
    private _content_filter!: Adw.ComboRow;

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

        this._settings.bind('api-key',
            this._api_key,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('username',
            this._username,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('query',
            this._query,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('collections',
            this._collections,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('topics',
            this._topics,
            'text',
            Gio.SettingsBindFlags.DEFAULT);

        // Setup combo rows with translatable UI elements
        const setupComboRowTranslation = (combo: Adw.ComboRow, settingsId: string, mapping: Map<string, string>): void => {
            const uiValues = Array.from(mapping.keys());
            combo.model = Gtk.StringList.new(uiValues);

            let selectedString = uiValues[combo.selected];
            let settingsString = mapping.get(selectedString);
            this._settings.setString(settingsId, settingsString ?? '');

            combo.connect('notify::selected', () => {
                selectedString = uiValues[combo.selected];
                settingsString = mapping.get(selectedString);
                this._settings.setString(settingsId, settingsString ?? '');
            });
        };
        setupComboRowTranslation(this._content_filter, 'content-filter', this.contentFilterTranslationMap);
        setupComboRowTranslation(this._orientation, 'orientation', this.orientationTranslationMap);
    }

    /**
     * Explicit mapping of translated UI text to settings string.
     *
     * @returns {Map<string, string>} Map of id strings to translated strings.
     */
    contentFilterTranslationMap = ((): Map<string, string> => {
        const mapping = new Map<string, string>();

        Object.values(ContentFilter).forEach(filter => {
            switch (filter) {
            case ContentFilter.LOW:
                mapping.set(_('Low'), ContentFilter.LOW);
                break;
            case ContentFilter.HIGH:
                mapping.set(_('High'), ContentFilter.HIGH);
                break;
            default:
                mapping.set('<unknown>', '<unknown>');
                break;
            }
        });

        return mapping;
    })();

    /**
     * Explicit mapping to ensure xgettext recognizes the stings.
     *
     * @returns {Map<string, string>} Map of id strings to translated strings.
     */
    orientationTranslationMap = ((): Map<string, string> => {
        const mapping = new Map<string, string>();

        Object.values(Orientation).forEach(filter => {
            switch (filter) {
            case Orientation.PORTRAIT:
                mapping.set(_('Portrait'), Orientation.PORTRAIT);
                break;
            case Orientation.LANDSCAPE:
                mapping.set(_('Landscape'), Orientation.LANDSCAPE);
                break;
            case Orientation.SQUARISH:
                mapping.set(_('Squarish'), Orientation.SQUARISH);
                break;
            default:
                mapping.set('<unknown>', '<unknown>');
                break;
            }
        });

        return mapping;
    })();

    /**
     * Clear all config options associated to this specific adapter.
     */
    clearConfig(): void {
        this._settings.resetSchema();
    }
}

export {UnsplashSettings};
