import * as Gio from 'gi://Gio';
import * as Gtk from 'gi://Gtk';

import * as ExtensionUtils from '@gi/misc/extensionUtils';

import * as Adw from '@gi/gtk4/adw/adw';
import type * as SettingsNamespace from './settings.js';
import type * as UtilsNamespace from './utils.js';
import type * as LoggerNamespace from './logger.js';
import type * as SourceRowNamespace from './ui/sourceRow.js';

let Settings: typeof SettingsNamespace;
let Utils: typeof UtilsNamespace;
let Logger: typeof LoggerNamespace;
let SourceRow: typeof SourceRowNamespace.SourceRow;

const Self = ExtensionUtils.getCurrentExtension();

/**
 *
 */
// eslint-disable-next-line no-unused-vars
function init() {
    // Convenience.initTranslations();
}

// https://gjs.guide/extensions/overview/anatomy.html#prefs-js
// The code in prefs.js will be executed in a separate Gtk process
// Here you will not have access to code running in GNOME Shell, but fatal errors or mistakes will be contained within that process.
// In this process you will be using the Gtk toolkit, not Clutter.

// https://gjs.guide/extensions/development/preferences.html#preferences-window
// Gnome 42+
/**
 *
 * @param {Adw.PreferencesWindow} window Window the extension should fill
 */
// eslint-disable-next-line no-unused-vars
function fillPreferencesWindow(window: Adw.PreferencesWindow) {
    window.set_default_size(-1, 720);
    // temporary fill window to prevent error message until modules are loaded
    const tmpPage = new Adw.PreferencesPage();
    window.add(tmpPage);

    new RandomWallpaperSettings(window, tmpPage);
}


// 40 < Gnome < 42
// function buildPrefsWidget() {
// let window = new Adw.PreferencesWindow();
// new RandomWallpaperSettings(window);
// return window;
// }

/* UI Setup */
class RandomWallpaperSettings {
    private _logger!: LoggerNamespace.Logger;
    private _settings!: SettingsNamespace.Settings;
    private _backendConnection!: SettingsNamespace.Settings;

    private _sources: string[] = [];
    private _builder = new Gtk.Builder();
    private _saveDialog: Gtk.FileChooserNative | undefined;

    constructor(window: Adw.PreferencesWindow, tmpPage: Adw.PreferencesPage) {
        // Dynamically load own modules. This allows us to use proper ES6 Modules
        this._importModules().then(() => {
            window.remove(tmpPage);

            if (!Logger || !Settings || !Utils || !SourceRow)
                throw new Error('Error with imports');

            this._logger = new Logger.Logger('RWG3', 'RandomWallpaper.Settings');
            this._settings = new Settings.Settings();
            this._backendConnection = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);

            this._backendConnection.setBoolean('pause-timer', true);
            this._loadSources();

            // this._builder.set_translation_domain(Self.metadata['gettext-domain']);
            this._builder.add_from_file(`${Self.path}/ui/pageGeneral.ui`);
            this._builder.add_from_file(`${Self.path}/ui/pageSources.ui`);

            this._fillTypeComboRow();

            this._settings.bind('minutes',
                this._builder.get_object('duration_minutes'),
                'value',
                Gio.SettingsBindFlags.DEFAULT);
            this._settings.bind('hours',
                this._builder.get_object('duration_hours'),
                'value',
                Gio.SettingsBindFlags.DEFAULT);
            this._settings.bind('auto-fetch',
                this._builder.get_object('af_switch'),
                'enable-expansion',
                Gio.SettingsBindFlags.DEFAULT);
            this._settings.bind('disable-hover-preview',
                this._builder.get_object('disable_hover_preview'),
                'active',
                Gio.SettingsBindFlags.DEFAULT);
            this._settings.bind('hide-panel-icon',
                this._builder.get_object('hide_panel_icon'),
                'active',
                Gio.SettingsBindFlags.DEFAULT);
            this._settings.bind('fetch-on-startup',
                this._builder.get_object('fetch_on_startup'),
                'active',
                Gio.SettingsBindFlags.DEFAULT);
            this._settings.bind('general-post-command',
                this._builder.get_object('general_post_command'),
                'text',
                Gio.SettingsBindFlags.DEFAULT);
            this._settings.bind('multiple-displays',
                this._builder.get_object('enable_multiple_displays'),
                'active',
                Gio.SettingsBindFlags.DEFAULT);

            this._bindButtons();
            this._bindHistorySection(window);

            window.connect('close-request', () => {
                this._backendConnection.setBoolean('pause-timer', false);
            });

            window.add(this._builder.get_object('page_general'));
            window.add(this._builder.get_object('page_sources'));

            this._sources.forEach(id => {
                const sourceRow = new SourceRow(undefined, id);
                // eslint-disable-next-line no-extra-parens
                (this._builder.get_object('sources_list') as Adw.PreferencesGroup).add(sourceRow);

                sourceRow.button_delete.connect('clicked', () => {
                    sourceRow.clearConfig();
                    // eslint-disable-next-line no-extra-parens
                    (this._builder.get_object('sources_list') as Adw.PreferencesGroup).remove(sourceRow);
                    Utils.removeItemOnce(this._sources, id);
                    this._saveSources();
                });
            });

            import('./hydraPaper.js').then(module => {
                if (new module.HydraPaper().isAvailable())
                    // eslint-disable-next-line no-extra-parens
                    (this._builder.get_object('multiple_displays_row') as Adw.ActionRow).set_sensitive(true);
            }).catch(logError);
        }).catch(error => {
            logError(error);
            throw error;
        });
    }

    /**
     * Import modules ES6 style instead the built-in gjs style.
     * Allows proper async/await in imported modules.
     */
    private async _importModules() {
        // All imports as dynamic loads to work around the fact this module won't be in a topmost
        // context inside the gnome shell and can't use import statements (yet).
        // PopOS' tiling extension and RoundedCorners Extension work around the above limitation by
        // manually rewriting the exported javascript file. We also have to do this but
        // not for our own modules.
        const loggerPromise = import('./logger.js');
        const utilsPromise = import('./utils.js');
        const sourceRowPromise = import('./ui/sourceRow.js');
        const settingsPromise =  import('./settings.js');

        const [moduleLogger, moduleUtils, moduleSourceRow, moduleSettings] = await Promise.all(
            [loggerPromise, utilsPromise, sourceRowPromise, settingsPromise]);
        Logger = moduleLogger;
        Utils = moduleUtils;
        SourceRow = moduleSourceRow.SourceRow;
        Settings = moduleSettings;
    }

    private _fillTypeComboRow() {
        const comboRow: Adw.ComboRow = this._builder.get_object('combo_background_type');

        // Fill combo from settings enum
        const availableTypes = this._settings.getSchema().get_key('change-type').get_range(); // GLib.Variant (sv)
        // (sv) = Tuple(%G_VARIANT_TYPE_STRING, %G_VARIANT_TYPE_VARIANT)
        // s should be 'enum'
        // v should be an array enumerating the possible values. Each item in the array is a possible valid value and no other values are valid.
        // v is 'as'
        const availableTypesNames = availableTypes.get_child_value(1).get_variant().get_strv();

        const stringList = Gtk.StringList.new(availableTypesNames);
        comboRow.model = stringList;
        comboRow.selected = this._settings.getEnum('change-type');

        comboRow.connect('notify::selected', _comboRow => {
            this._settings.setEnum('change-type', _comboRow.selected);
        });
    }

    private _bindButtons() {
        const newWallpaperButton: Adw.ActionRow = this._builder.get_object('request_new_wallpaper');
        const newWallpaperButtonLabel = newWallpaperButton.get_child() as Gtk.Label | null;
        const origNewWallpaperText = newWallpaperButtonLabel?.get_label() ?? 'Request New Wallpaper';
        newWallpaperButton.connect('activated', () => {
            newWallpaperButtonLabel?.set_label('Loading ...');
            newWallpaperButton.set_sensitive(false);

            // The backend sets this back to false after fetching the image - listen for that event.
            const handler = this._backendConnection.observe('request-new-wallpaper', () => {
                if (!this._backendConnection.getBoolean('request-new-wallpaper')) {
                    newWallpaperButtonLabel?.set_label(origNewWallpaperText);
                    newWallpaperButton.set_sensitive(true);
                    this._backendConnection.disconnect(handler);
                }
            });

            this._backendConnection.setBoolean('request-new-wallpaper', true);
        });

        const sourceRowList = this._builder.get_object('sources_list') as Adw.PreferencesGroup;
        this._builder.get_object('button_new_source').connect('clicked', () => {
            const sourceRow = new SourceRow();
            sourceRowList.add(sourceRow);
            this._sources.push(String(sourceRow.id));
            this._saveSources();

            sourceRow.button_delete.connect('clicked', () => {
                sourceRow.clearConfig();
                sourceRowList.remove(sourceRow);
                Utils.removeItemOnce(this._sources, sourceRow.id);
                this._saveSources();
            });
        });
    }

    private _bindHistorySection(window: Adw.PreferencesWindow) {
        const entryRow = this._builder.get_object('row_favorites_folder') as Adw.EntryRow;
        entryRow.text = this._settings.getString('favorites-folder');

        this._settings.bind('history-length',
            this._builder.get_object('history_length'),
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('favorites-folder',
            entryRow,
            'text',
            Gio.SettingsBindFlags.DEFAULT);

        this._builder.get_object('clear_history').connect('clicked', () => {
            this._backendConnection.setBoolean('clear-history', true);
        });

        this._builder.get_object('open_wallpaper_folder').connect('clicked', () => {
            this._backendConnection.setBoolean('open-folder', true);
        });

        this._builder.get_object('button_favorites_folder').connect('clicked', () => {
            // For GTK 4.10+
            // Gtk.FileDialog();

            // https://stackoverflow.com/a/54487948
            this._saveDialog = new Gtk.FileChooserNative({
                title: 'Choose a Wallpaper Folder',
                action: Gtk.FileChooserAction.SELECT_FOLDER,
                accept_label: 'Open',
                cancel_label: 'Cancel',
                transient_for: window,
                modal: true,
            });

            this._saveDialog.connect('response', (dialog, response_id) => {
                if (response_id === Gtk.ResponseType.ACCEPT) {
                    const text = dialog.get_file()?.get_path();
                    if (text)
                        entryRow.text = text;
                }
                dialog.destroy();
            });

            this._saveDialog.show();
        });
    }

    /**
     * Load the config from the schema
     */
    private _loadSources() {
        this._sources = this._settings.getStrv('sources');

        // this._sources.sort((a, b) => {
        // let path1 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${a}/`;
        // let settingsGeneral1 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path1);
        // let path2 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${b}/`;
        // let settingsGeneral2 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path2);

        // const nameA = settingsGeneral1.get('name', 'string').toUpperCase();
        // const nameB = settingsGeneral2.get('name', 'string').toUpperCase();

        // return nameA.localeCompare(nameB);
        // });

        this._sources.sort((a, b) => {
            let path1 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${a}/`;
            let settingsGeneral1 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path1);
            let path2 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${b}/`;
            let settingsGeneral2 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path2);
            return settingsGeneral1.getEnum('type') - settingsGeneral2.getEnum('type');
        });
    }

    private _saveSources() {
        this._settings.setStrv('sources', this._sources);
    }
}
