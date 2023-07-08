// Use legacy style importing to work around standard imports not available in files loaded by the shell, those can't be modules (yet)
// > Note that as of GNOME 44, neither GNOME Shell nor Extensions support ESModules, and must use GJS custom import scheme.
// https://gjs.guide/extensions/overview/imports-and-modules.html#imports-and-modules
// https://gjs-docs.gnome.org/gjs/esmodules.md
// > JS ERROR: Extension randomwallpaper@iflow.space: SyntaxError: import declarations may only appear at top level of a module
// For correct typing use: 'InstanceType<typeof Adw.ActionRow>'
const Adw = imports.gi.Adw;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;

import type * as SettingsNamespace from './settings.js';
import type * as UtilsNamespace from './utils.js';
import type * as LoggerNamespace from './logger.js';
import type * as SourceRowNamespace from './ui/sourceRow.js';
import type {ExtensionMeta} from 'ExtensionMeta';

let Settings: typeof SettingsNamespace;
let Utils: typeof UtilsNamespace;
let Logger: typeof LoggerNamespace;
let SourceRow: typeof SourceRowNamespace.SourceRow;

const Self = ExtensionUtils.getCurrentExtension();

/**
 * Like `extension.js` this is used for any one-time setup like translations.
 *
 * @param {ExtensionMeta} unusedMeta - An extension meta object, https://gjs.guide/extensions/overview/anatomy.html#extension-meta-object
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
function init(unusedMeta: ExtensionMeta): void {
    // Convenience.initTranslations();
}

// https://gjs.guide/extensions/overview/anatomy.html#prefs-js
// The code in prefs.js will be executed in a separate Gtk process
// Here you will not have access to code running in GNOME Shell, but fatal errors or mistakes will be contained within that process.
// In this process you will be using the Gtk toolkit, not Clutter.

// https://gjs.guide/extensions/development/preferences.html#preferences-window
// Gnome 42+
/**
 * This function is called when the preferences window is first created to fill
 * the `Adw.PreferencesWindow`.
 *
 * This function will only be called by GNOME 42 and later. If this function is
 * present, `buildPrefsWidget()` will NOT be called.
 *
 * @param {Adw.PreferencesWindow} window - The preferences window
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
function fillPreferencesWindow(window: InstanceType<typeof Adw.PreferencesWindow>): void {
    window.set_default_size(600, 720);
    // temporary fill window to prevent error message until modules are loaded
    const tmpPage = new Adw.PreferencesPage();
    window.add(tmpPage);

    new RandomWallpaperSettings(window, tmpPage);
}

/**
 * Main settings class for everything related to the settings window.
 */
class RandomWallpaperSettings {
    private _logger!: LoggerNamespace.Logger;
    private _settings!: SettingsNamespace.Settings;
    private _backendConnection!: SettingsNamespace.Settings;

    private _sources: string[] = [];
    private _builder = new Gtk.Builder();
    private _saveDialog: InstanceType<typeof Gtk.FileChooserNative> | undefined;

    /**
     * Create a new ui settings class.
     *
     * Replaces the placeholder $tmpPage once the modules are loaded and the real pages are available.
     *
     * @param {Adw.PreferencesWindow} window Window to fill with settings
     * @param {Adw.PreferencesPage} tmpPage Placeholder settings page to replace
     */
    constructor(window: InstanceType<typeof Adw.PreferencesWindow>, tmpPage: InstanceType<typeof Adw.PreferencesPage>) {
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

            import('./manager/wallpaperManager.js').then(module => {
                const comboBackgroundType = this._builder.get_object<InstanceType<typeof Adw.ComboRow>>('combo_background_type');
                comboBackgroundType.model = Gtk.StringList.new(module.getModeNameList());
                this._settings.bind('change-type',
                    comboBackgroundType,
                    'selected',
                    Gio.SettingsBindFlags.DEFAULT);
            }).catch(error => {
                this._logger.error(error);
            });

            const comboLogLevel = this._builder.get_object<InstanceType<typeof Adw.ComboRow>>('log_level');
            comboLogLevel.model = Gtk.StringList.new(Logger.getLogLevelNameList());
            this._settings.bind('log-level',
                comboLogLevel,
                'selected',
                Gio.SettingsBindFlags.DEFAULT);

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
                this._builder.get_object<InstanceType<typeof Adw.PreferencesGroup>>('sources_list').add(sourceRow);

                sourceRow.button_delete.connect('clicked', () => {
                    sourceRow.clearConfig();
                    this._builder.get_object<InstanceType<typeof Adw.PreferencesGroup>>('sources_list').remove(sourceRow);
                    Utils.removeItemOnce(this._sources, id);
                    this._saveSources();
                });
            });

            import('./utils.js').then(module => {
                const manager = module.getWallpaperManager();
                if (manager.canHandleMultipleImages)
                    this._builder.get_object<InstanceType<typeof Adw.ActionRow>>('multiple_displays_row').set_sensitive(true);
            }).catch(error => {
                this._logger.error(error);
            });
        }).catch(error => {
            if (error instanceof Error)
                logError(error);
            else
                logError(new Error('Unknown error'));
        });
    }

    /**
     * Import helper function.
     *
     * Loads all required modules async.
     * This allows to omit the legacy GJS style imports (`const asd = imports.gi.asd`)
     * and use proper modules for subsequent files.
     *
     * When the shell allows proper modules for loaded files (extension.js and prefs.js)
     * this function can be removed and replaced by normal import statements.
     */
    private async _importModules(): Promise<void> {
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

    /**
     * Bind button clicks to logic.
     */
    private _bindButtons(): void {
        const newWallpaperButton: InstanceType<typeof Adw.ActionRow> = this._builder.get_object('request_new_wallpaper');
        const newWallpaperButtonLabel = newWallpaperButton.get_child() as InstanceType<typeof Gtk.Label> | null;
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

        const sourceRowList = this._builder.get_object<InstanceType<typeof Adw.PreferencesGroup>>('sources_list');
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

    /**
     * Bind button clicks related to the history.
     *
     * @param {Adw.PreferencesWindow} window Preferences window
     */
    private _bindHistorySection(window: InstanceType<typeof Adw.PreferencesWindow>): void {
        const entryRow = this._builder.get_object<InstanceType<typeof Adw.EntryRow>>('row_favorites_folder');
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
    private _loadSources(): void {
        this._sources = this._settings.getStrv('sources');

        // this._sources.sort((a, b) => {
        // const path1 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${a}/`;
        // const settingsGeneral1 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path1);
        // const path2 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${b}/`;
        // const settingsGeneral2 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path2);

        // const nameA = settingsGeneral1.get('name', 'string').toUpperCase();
        // const nameB = settingsGeneral2.get('name', 'string').toUpperCase();

        // return nameA.localeCompare(nameB);
        // });

        this._sources.sort((a, b) => {
            const path1 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${a}/`;
            const settingsGeneral1 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path1);
            const path2 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${b}/`;
            const settingsGeneral2 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path2);
            return settingsGeneral1.getInt('type') - settingsGeneral2.getInt('type');
        });
    }

    /**
     * Save all configured sources to the settings.
     */
    private _saveSources(): void {
        this._settings.setStrv('sources', this._sources);
    }
}
