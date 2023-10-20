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
 * Main settings class for everything related to the settings window.
 */
class RandomWallpaperSettings extends ExtensionPreferences {
    private _saveDialog?: Gtk.FileChooserNative;

    /**
     * This function is called when the preferences window is first created to fill
     * the `Adw.PreferencesWindow`.
     *
     * @param {Adw.PreferencesWindow} window - The preferences window
     */
    fillPreferencesWindow(window: Adw.PreferencesWindow): void {
        Settings.Settings.extensionContext = ExtensionPreferences;
        const backendConnection = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);
        const builder = new Gtk.Builder();
        const settings = new Settings.Settings();
        const sources = this._loadSources(settings);

        window.set_default_size(600, 720);

        backendConnection.setBoolean('pause-timer', true);

        const extensionObject = ExtensionPreferences.lookupByURL(import.meta.url);
        if (!extensionObject) {
            Logger.error('Own extension object not found!', this);
            throw new Error('Own extension object not found!');
        }

        // this._builder.set_translation_domain(extensionObject.metadata['gettext-domain']);
        builder.add_from_file(`${extensionObject.path}/ui/pageGeneral.ui`);
        builder.add_from_file(`${extensionObject.path}/ui/pageSources.ui`);

        const comboBackgroundType = builder.get_object<Adw.ComboRow>('combo_background_type');
        comboBackgroundType.model = Gtk.StringList.new(WallpaperManager.getModeNameList());
        settings.bind('change-type',
            comboBackgroundType,
            'selected',
            Gio.SettingsBindFlags.DEFAULT);

        const comboLogLevel = builder.get_object<Adw.ComboRow>('log_level');
        comboLogLevel.model = Gtk.StringList.new(Logger.getLogLevelNameList());
        settings.bind('log-level',
            comboLogLevel,
            'selected',
            Gio.SettingsBindFlags.DEFAULT);

        settings.bind('minutes',
            builder.get_object('duration_minutes'),
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('hours',
            builder.get_object('duration_hours'),
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('auto-fetch',
            builder.get_object('af_switch'),
            'enable-expansion',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('disable-hover-preview',
            builder.get_object('disable_hover_preview'),
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('hide-panel-icon',
            builder.get_object('hide_panel_icon'),
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('show-notifications',
            builder.get_object('show_notifications'),
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('fetch-on-startup',
            builder.get_object('fetch_on_startup'),
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('general-post-command',
            builder.get_object('general_post_command'),
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('multiple-displays',
            builder.get_object('enable_multiple_displays'),
            'active',
            Gio.SettingsBindFlags.DEFAULT);

        this._bindButtons(settings, backendConnection, builder, sources);
        this._bindHistorySection(settings, backendConnection, builder, window);

        window.connect('close-request', () => {
            backendConnection.setBoolean('pause-timer', false);
            Settings.Settings.extensionContext = undefined;
        });

        window.add(builder.get_object('page_general'));
        window.add(builder.get_object('page_sources'));

        sources.forEach(id => {
            const sourceRow = new SourceRow.SourceRow(undefined, id);
            builder.get_object<Adw.PreferencesGroup>('sources_list').add(sourceRow);

            sourceRow.button_delete.connect('clicked', () => {
                sourceRow.clearConfig();
                builder.get_object<Adw.PreferencesGroup>('sources_list').remove(sourceRow);
                Utils.removeItemOnce(sources, id);
                this._saveSources(settings, sources);
            });
        });

        const manager = Utils.getWallpaperManager();
        if (manager.canHandleMultipleImages)
            builder.get_object<Adw.ActionRow>('multiple_displays_row').set_sensitive(true);
    }

    /**
     * Bind button clicks to logic.
     *
     * @param {Settings.Settings} settings Settings object holding general settings
     * @param {Settings.Settings} backendConnection Settings object holding backend settings
     * @param {Gtk.Builder} builder Gtk builder of the preference window
     * @param {string[]} sources String array of sources to process
     */
    private _bindButtons(settings: Settings.Settings, backendConnection: Settings.Settings, builder: Gtk.Builder, sources: string[]): void {
        const newWallpaperButton: Adw.ActionRow = builder.get_object('request_new_wallpaper');
        const newWallpaperButtonLabel = newWallpaperButton.get_child() as Gtk.Label | null;
        const origNewWallpaperText = newWallpaperButtonLabel?.get_label() ?? 'Request New Wallpaper';
        newWallpaperButton.connect('activated', () => {
            newWallpaperButtonLabel?.set_label('Loading ...');
            newWallpaperButton.set_sensitive(false);

            // The backend sets this back to false after fetching the image - listen for that event.
            const handler = backendConnection.observe('request-new-wallpaper', () => {
                if (!backendConnection.getBoolean('request-new-wallpaper')) {
                    newWallpaperButtonLabel?.set_label(origNewWallpaperText);
                    newWallpaperButton.set_sensitive(true);
                    backendConnection.disconnect(handler);
                }
            });

            backendConnection.setBoolean('request-new-wallpaper', true);
        });

        const sourceRowList = builder.get_object<Adw.PreferencesGroup>('sources_list');
        builder.get_object('button_new_source').connect('clicked', () => {
            const sourceRow = new SourceRow.SourceRow();
            sourceRowList.add(sourceRow);
            sources.push(String(sourceRow.id));
            this._saveSources(settings, sources);

            sourceRow.button_delete.connect('clicked', () => {
                sourceRow.clearConfig();
                sourceRowList.remove(sourceRow);
                Utils.removeItemOnce(sources, sourceRow.id);
                this._saveSources(settings, sources);
            });
        });
    }

    /**
     * Bind button clicks related to the history.
     *
     * @param {Settings.Settings} settings Settings object holding general settings
     * @param {Settings.Settings} backendConnection Settings object holding backend settings
     * @param {Gtk.Builder} builder Gtk builder of the preference window
     * @param {Adw.PreferencesWindow} window Preferences window
     */
    private _bindHistorySection(settings: Settings.Settings, backendConnection: Settings.Settings, builder: Gtk.Builder, window: Adw.PreferencesWindow): void {
        const entryRow = builder.get_object<Adw.EntryRow>('row_favorites_folder');
        entryRow.text = settings.getString('favorites-folder');

        settings.bind('history-length',
            builder.get_object('history_length'),
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('favorites-folder',
            entryRow,
            'text',
            Gio.SettingsBindFlags.DEFAULT);

        builder.get_object('clear_history').connect('clicked', () => {
            backendConnection.setBoolean('clear-history', true);
        });

        builder.get_object('open_wallpaper_folder').connect('clicked', () => {
            backendConnection.setBoolean('open-folder', true);
        });

        builder.get_object('button_favorites_folder').connect('clicked', () => {
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
     *
     * @param {Settings.Settings} settings Settings object used for loading
     * @returns {string[]} Array of strings of loaded sources
     */
    private _loadSources(settings: Settings.Settings): string[] {
        const sources = settings.getStrv('sources');

        // this._sources.sort((a, b) => {
        // const path1 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${a}/`;
        // const settingsGeneral1 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path1);
        // const path2 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${b}/`;
        // const settingsGeneral2 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path2);

        // const nameA = settingsGeneral1.get('name', 'string').toUpperCase();
        // const nameB = settingsGeneral2.get('name', 'string').toUpperCase();

        // return nameA.localeCompare(nameB);
        // });

        sources.sort((a, b) => {
            const path1 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${a}/`;
            const settingsGeneral1 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path1);
            const path2 = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${b}/`;
            const settingsGeneral2 = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path2);
            return settingsGeneral1.getInt('type') - settingsGeneral2.getInt('type');
        });

        return sources;
    }

    /**
     * Save all configured sources to the settings.
     *
     * @param {Settings.Settings} settings Settings object used for saving
     * @param {string[]} sources String array of sources to save
     */
    private _saveSources(settings: Settings.Settings, sources: string[]): void {
        settings.setStrv('sources', sources);
    }
}

export {RandomWallpaperSettings as default};
