import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

// Legacy importing style for shell internal bindings not available in standard import format
const ExtensionUtils = imports.misc.extensionUtils;

import * as Settings from './../settings.js';

const Self = ExtensionUtils.getCurrentExtension();

const LocalFolderSettingsGroup = GObject.registerClass({
    GTypeName: 'LocalFolderSettingsGroup',
    Template: GLib.filename_to_uri(`${Self.path}/ui/localFolder.ui`, null),
    InternalChildren: [
        'folder',
        'folder_row',
    ],
}, class LocalFolderSettingsGroup extends Adw.PreferencesGroup {
    // InternalChildren
    private _folder!: Gtk.Button;
    private _folder_row!: Adw.EntryRow;

    private _saveDialog: Gtk.FileChooserNative | undefined;
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

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/localFolder/${id}/`;
        this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER, path);

        this._settings.bind('folder',
            this._folder_row,
            'text',
            Gio.SettingsBindFlags.DEFAULT);

        this._folder.connect('clicked', () => {
            // TODO: GTK 4.10+
            // Gtk.FileDialog();

            // https://stackoverflow.com/a/54487948
            this._saveDialog = new Gtk.FileChooserNative({
                title: 'Choose a Wallpaper Folder',
                action: Gtk.FileChooserAction.SELECT_FOLDER,
                accept_label: 'Open',
                cancel_label: 'Cancel',
                transient_for: this.get_root() as Gtk.Window ?? undefined,
                modal: true,
            });

            this._saveDialog.connect('response', (_dialog, response_id) => {
                // FIXME: ESLint complains about this comparison somehow?
                // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
                if (response_id === Gtk.ResponseType.ACCEPT) {
                    const chosenPath = _dialog.get_file()?.get_path();

                    if (chosenPath)
                        this._folder_row.text = chosenPath;
                }
                _dialog.destroy();
            });

            this._saveDialog.show();
        });
    }

    /**
     * Clear all config options associated to this specific adapter.
     */
    clearConfig(): void {
        this._settings.resetSchema();
    }
});

export {LocalFolderSettingsGroup};
