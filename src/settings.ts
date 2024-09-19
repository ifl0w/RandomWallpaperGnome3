import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import {ExtensionBase} from 'sharedInternals';

const RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.backend-connection';
const RWG_SETTINGS_SCHEMA_SOURCES_GENERAL = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.general';
const RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.genericJSON';
const RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.localFolder';
const RWG_SETTINGS_SCHEMA_SOURCES_REDDIT = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.reddit';
const RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.unsplash-api-key';
const RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.urlSource';
const RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.wallhaven';

const RWG_SETTINGS_SCHEMA_PATH = '/org/gnome/shell/extensions/space-iflow-randomwallpaper';

/**
 * Wrapper around gnome settings.
 */
class Settings {
    public static extensionContext?: typeof ExtensionBase;
    private _settings: Gio.Settings;

    /**
     * Create a new settings object.
     *
     * Will default to the general extension settings.
     * Set the static extension context before first use!
     *
     * @param {string | undefined} schemaId Schema ID or undefined, defaults to the extension schema ID
     * @param {string | undefined} schemaPath Schema path or undefined
     */
    constructor(schemaId?: string, schemaPath?: string) {
        if (!Settings.extensionContext)
            throw new Error('Settings module used before context was set!');

        const extensionObject = Settings.extensionContext.lookupByURL(import.meta.url);
        if (!extensionObject)
            throw new Error('Own extension object not found!');

        if (schemaPath === undefined) {
            this._settings = extensionObject.getSettings(schemaId);
        } else {
            // ExtensionUtils.getSettings() doesn't allow specifying a schema path
            // We need the schema path to allow for account style settings (having the
            // same settings schema id for multiple similar but distinctive settings objects).
            // So we have to rebuild the original getSettings() function to get the raw
            // schema object and build the Gio.Settings on our own with the schema path.
            const schemaObj = this._getSchema(extensionObject, schemaId);

            this._settings = new Gio.Settings({settings_schema: schemaObj, path: schemaPath});
        }
    }

    /**
     * Bind a settings key to a GObject property.
     *
     * A GObject can only bind to one setting at a time.
     * See observe() for one-way tracking with multiple watchers.
     *
     * @param {string} keyName Name of the setting key
     * @param {GObject.Object} gObject GObject to bind to
     * @param {string} property Name of the GObject property to bind to
     * @param {Gio.SettingsBindFlags} settingsBindFlags Flags
     */
    bind(keyName: string, gObject: GObject.Object, property: string, settingsBindFlags: Gio.SettingsBindFlags): void {
        this._settings.bind(keyName, gObject, property, settingsBindFlags);
    }

    /**
     * Disconnect a watcher initiated by observe().
     *
     * @param {number} handler ID of the observer to disconnect
     */
    disconnect(handler: number): void {
        this._settings.disconnect(handler);
    }

    /**
     * Get a boolean saved in a key.
     *
     * @param {string} key Key to query
     * @returns {boolean} The saved value
     */
    getBoolean(key: string): boolean {
        return this._settings.get_boolean(key);
    }

    /**
     * Get an Enum saved in a key.
     *
     * @param {string} key Key to query
     * @returns {number} The saved value
     */
    getEnum(key: string): number {
        return this._settings.get_enum(key);
    }

    /**
     * Get a number saved in a key.
     *
     * @param {string} key Key to query
     * @returns {number} The saved value
     */
    getInt(key: string): number {
        return this._settings.get_int(key);
    }

    /**
     * Get a number saved in a key.
     *
     * @param {string} key Key to query
     * @returns {number} The saved value
     */
    getInt64(key: string): number {
        return this._settings.get_int64(key);
    }

    /**
     * Get a string saved in a key.
     *
     * @param {string} key Key to query
     * @returns {string} The saved value
     */
    getString(key: string): string {
        return this._settings.get_string(key) ?? '';
    }

    /**
     * Get a list of strings saved in a key.
     *
     * @param {string} key Key to query
     * @returns {string[]} The saved value
     */
    getStrv(key: string): string[] {
        return this._settings.get_strv(key);
    }

    /**
     * Get the current settings schema.
     *
     * @returns {Gio.SettingsSchema} The schema in use
     */
    getSchema(): Gio.SettingsSchema {
        return this._settings.settings_schema;
    }

    /**
     * Check if the schema key is writable.
     *
     * @param {string} key Key to query
     * @returns {boolean} Whether the key is writable
     */
    isWritable(key: string): boolean {
        return this._settings.is_writable(key);
    }

    /**
     * List all keys available in the schema.
     *
     * @returns {string[]} List of keys
     */
    listKeys(): string[] {
        return this._settings.list_keys();
    }

    /**
     * Watch a setting for changes.
     *
     * @param {string} key Settings key to watch for changes
     * @param {(...args: unknown[]) => unknown} callback Function to call on value changes
     * @returns {number} Handler ID, use for disconnect
     */
    observe(key: string, callback: (...args: unknown[]) => unknown): number {
        return this._settings.connect(`changed::${key}`, callback);
    }

    /**
     * Resets a key to its default value effectively removing this key.
     *
     * @param {string} keyName Key to reset
     */
    reset(keyName: string): void {
        this._settings.reset(keyName);
    }

    /**
     * Reset a whole schema to its default value effectively removing this schema.
     */
    resetSchema(): void {
        for (const key of this._settings.settings_schema.list_keys())
            this.reset(key);
    }

    /**
     * Save a boolean to a key.
     *
     * @param {string} key Key to save in
     * @param {boolean} value Value to save
     */
    setBoolean(key: string, value: boolean): void {
        if (this._settings.set_boolean(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: boolean) with the value ${String(value)}`);
    }

    /**
     * Save an Enum to a key.
     *
     * @param {string} key Key to save in
     * @param {number} value Value to save
     */
    setEnum(key: string, value: number): void {
        if (this._settings.set_enum(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: number) with the value ${value}`);
    }

    /**
     * Save a number to a key.
     *
     * @param {string} key Key to save in
     * @param {number} value Value to save
     */
    setInt(key: string, value: number): void {
        if (this._settings.set_int(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: number) with the value ${value}`);
    }

    /**
     * Save a number to a key.
     *
     * @param {string} key Key to save in
     * @param {number} value Value to save
     */
    setInt64(key: string, value: number): void {
        if (this._settings.set_int64(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: number64) with the value ${value}`);
    }

    /**
     * Save a string to a key.
     *
     * @param {string} key Key to save in
     * @param {string} value Value to save
     */
    setString(key: string, value: string): void {
        if (this._settings.set_string(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: string) with the value ${value}`);
    }

    /**
     * Save a list of strings to a key.
     *
     * @param {string} key Key to save in
     * @param {string[]} value Value to save
     */
    setStrv(key: string, value: string[]): void {
        if (this._settings.set_strv(key, value))
            this._save();
        else
            throw new Error(`Could not set ${key} (type: string[]) with the value "${value.toString()}"`);
    }

    /**
     * Sync the settings object to disk.
     */
    private _save(): void {
        Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140
    }

    /**
     * Helper function to get the extension settings schema object.
     *
     * @param {ExtensionBase} extensionObject Extension object holding metadata in relation to the current context
     * @param {string | undefined} schemaId Schema ID, defaults to the extension settings schema ID
     * @returns {Gio.SettingsSchema} Settings schema object for the given ID
     */
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/extensions/sharedInternals.js#L91
    private _getSchema(extensionObject: ExtensionBase, schemaId?: string): Gio.SettingsSchema {
        if (!schemaId)
            schemaId = extensionObject.metadata['settings-schema'];

        // Expect USER extensions to have a schemas/ subfolder, otherwise assume a
        // SYSTEM extension that has been installed in the same prefix as the shell
        const schemaDir = extensionObject.dir.get_child('schemas');
        let schemaSource;
        const schemaPath = schemaDir.get_path();
        if (schemaDir.query_exists(null) && schemaPath !== null) {
            schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaPath,
                Gio.SettingsSchemaSource.get_default(),
                false);
        } else {
            schemaSource = Gio.SettingsSchemaSource.get_default();
        }

        let schemaObj;
        if (schemaId)
            schemaObj = schemaSource?.lookup(schemaId, true);

        if (!schemaObj)
            throw new Error(`Schema ${schemaId} could not be found for extension ${extensionObject.metadata.uuid}. Please check your installation`);

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
