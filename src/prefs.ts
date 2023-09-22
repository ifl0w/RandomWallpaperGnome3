import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Settings from './settings.js';
import * as SourceRow from './ui/sourceRow.js';
import * as Utils from './utils.js';
import * as WallpaperManager from './manager/wallpaperManager.js';

import {Logger} from './logger.js';

// https://gjs.guide/extensions/overview/anatomy.html#prefs-js
// The code in prefs.js will be executed in a separate Gtk process
// Here you will not have access to code running in GNOME Shell, but fatal errors or mistakes will be contained within that process.
// In this process you will be using the Gtk toolkit, not Clutter.

/**
 * Initial entry point for the extension settings page
 */
export default class RWG3Settings extends ExtensionPreferences {
    /**
     * This function is called when the preferences window is first created to fill
     * the `Adw.PreferencesWindow`.
     *
     * @param {Adw.PreferencesWindow} window - The preferences window
     */
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    fillPreferencesWindow(window: Adw.PreferencesWindow): void {
        window.set_default_size(600, 720);
        // temporary fill window to prevent error message until modules are loaded
        const tmpPage = new Adw.PreferencesPage();
        window.add(tmpPage);

        new RandomWallpaperSettings(window, tmpPage);
    }
}

/**
 * Main settings class for everything related to the settings window.
 */
class RandomWallpaperSettings {
    private _settings = new Settings.Settings();
    private _backendConnection = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);

    private _sources: string[] = [];
    private _builder = new Gtk.Builder();
    private _saveDialog: Gtk.FileChooserNative | undefined;

    /**
     * Create a new ui settings class.
     *
     * Replaces the placeholder $tmpPage once the modules are loaded and the real pages are available.
     *
     * @param {Adw.PreferencesWindow} window Window to fill with settings
     * @param {Adw.PreferencesPage} tmpPage Placeholder settings page to replace
     */
    constructor(window: Adw.PreferencesWindow, tmpPage: Adw.PreferencesPage) {
        window.remove(tmpPage);

        this._backendConnection.setBoolean('pause-timer', true);
        this._loadSources();

        const extensionObject = ExtensionPreferences.lookupByURL(import.meta.url);
        if (!extensionObject) {
            Logger.error('Own extension object not found!', this);
            throw new Error('Own extension object not found!');
        }

        // this._builder.set_translation_domain(extensionObject.metadata['gettext-domain']);
        this._builder.add_from_file(`${extensionObject.path}/ui/pageGeneral.ui`);
        this._builder.add_from_file(`${extensionObject.path}/ui/pageSources.ui`);

        const comboBackgroundType = this._builder.get_object<Adw.ComboRow>('combo_background_type');
        comboBackgroundType.model = Gtk.StringList.new(WallpaperManager.getModeNameList());
        this._settings.bind('change-type',
            comboBackgroundType,
            'selected',
            Gio.SettingsBindFlags.DEFAULT);

        const comboLogLevel = this._builder.get_object<Adw.ComboRow>('log_level');
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
        this._settings.bind('show-notifications',
            this._builder.get_object('show_notifications'),
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
            const sourceRow = new SourceRow.SourceRow(undefined, id);
            this._builder.get_object<Adw.PreferencesGroup>('sources_list').add(sourceRow);

            sourceRow.button_delete.connect('clicked', () => {
                sourceRow.clearConfig();
                this._builder.get_object<Adw.PreferencesGroup>('sources_list').remove(sourceRow);
                Utils.removeItemOnce(this._sources, id);
                this._saveSources();
            });
        });

        const manager = Utils.getWallpaperManager();
        if (manager.canHandleMultipleImages)
            this._builder.get_object<Adw.ActionRow>('multiple_displays_row').set_sensitive(true);
    }

    /**
     * Bind button clicks to logic.
     */
    private _bindButtons(): void {
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

        const sourceRowList = this._builder.get_object<Adw.PreferencesGroup>('sources_list');
        this._builder.get_object('button_new_source').connect('clicked', () => {
            const sourceRow = new SourceRow.SourceRow();
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
    private _bindHistorySection(window: Adw.PreferencesWindow): void {
        const entryRow = this._builder.get_object<Adw.EntryRow>('row_favorites_folder');
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
                // FIXME: ESLint complains about this comparison somehow?
                // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
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
