import * as Gio from 'gi://Gio';
import * as GObject from 'gi://GObject';

import * as ExtensionUtils from '@gi/misc/extensionUtils';

const Self = ExtensionUtils.getCurrentExtension();

const RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.backend-connection';
const RWG_SETTINGS_SCHEMA_SOURCES_GENERAL = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.general';
const RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.genericJSON';
const RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.localFolder';
const RWG_SETTINGS_SCHEMA_SOURCES_REDDIT = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.reddit';
const RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.unsplash';
const RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.urlSource';
const RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.wallhaven';

const RWG_SETTINGS_SCHEMA_PATH = '/org/gnome/shell/extensions/space-iflow-randomwallpaper';

class Settings {
    private _settings: Gio.Settings;

    constructor(schemaId?: string, schemaPath?: string) {
        if (schemaPath === undefined) {
            this._settings = ExtensionUtils.getSettings(schemaId);
        } else {
            // We can't give a path so we need to rebuild the function:
            const schemaObj = this._getSchema(schemaId);

            // Everything above for… this…
            this._settings = new Gio.Settings({settings_schema: schemaObj, path: schemaPath});
        }
    }

    bind(keyName: string, gObject: GObject.Object, property: string, settingsBindFlags: Gio.SettingsBindFlags) {
        this._settings.bind(keyName, gObject, property, settingsBindFlags);
    }

    disconnect(handler: number) {
        return this._settings.disconnect(handler);
    }

    getBoolean(key: string): boolean {
        return this._settings.get_boolean(key);
    }

    getEnum(key: string): number {
        return this._settings.get_enum(key);
    }

    getInt(key: string): number {
        return this._settings.get_int(key);
    }

    getInt64(key: string): number {
        return this._settings.get_int64(key);
    }

    getString(key: string): string {
        return this._settings.get_string(key);
    }

    getStrv(key: string): string[] {
        return this._settings.get_strv(key);
    }

    getSchema() {
        return this._settings.settings_schema;
    }

    isWritable(key: string) {
        return this._settings.is_writable(key);
    }

    listKeys() {
        return this._settings.list_keys();
    }

    // eslint-disable-next-line no-unused-vars
    observe(key: string, callback: (...args: any[]) => any) {
        return this._settings.connect(`changed::${key}`, callback);
    }

    reset(keyName: string) {
        this._settings.reset(keyName);
    }

    setBoolean(key: string, value: boolean) {
        if (this._settings.set_boolean(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: boolean) with the value ${value}`);
    }

    setEnum(key: string, value: number) {
        if (this._settings.set_enum(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: number) with the value ${value}`);
    }

    setInt64(key: string, value: number) {
        if (this._settings.set_int64(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: number64) with the value ${value}`);
    }

    setString(key: string, value: string) {
        if (this._settings.set_string(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: string) with the value ${value}`);
    }

    setStrv(key: string, value: string[]) {
        if (this._settings.set_strv(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: string[]) with the value ${value}`);
    }

    private _save() {
        Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140
    }

    private _getSchema(schemaId?: string) {
        // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/gnome-43/js/misc/extensionUtils.js#L211
        if (!schemaId)
            schemaId = Self.metadata['settings-schema'];

        // Expect USER extensions to have a schemas/ subfolder, otherwise assume a
        // SYSTEM extension that has been installed in the same prefix as the shell
        const schemaDir = Self.dir.get_child('schemas');
        let schemaSource;
        const schemaPath = schemaDir.get_path();
        if (schemaDir.query_exists(null) && schemaPath !== null) {
            schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaPath,
                Gio.SettingsSchemaSource.get_default(),
                false);
        } else {
            schemaSource = Gio.SettingsSchemaSource.get_default();
        }

        const schemaObj = schemaSource?.lookup(schemaId, true);
        if (!schemaObj)
            throw new Error(`Schema ${schemaId} could not be found for extension ${Self.metadata.uuid}. Please check your installation`);

        return schemaObj;
    }
}

export {
    Settings,
    RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION,
    RWG_SETTINGS_SCHEMA_PATH,
    RWG_SETTINGS_SCHEMA_SOURCES_GENERAL,
    RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON,
    RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER,
    RWG_SETTINGS_SCHEMA_SOURCES_REDDIT,
    RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH,
    RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE,
    RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN
};
