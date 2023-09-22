/* eslint-disable */

declare module 'sharedInternals' {
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/extensions/sharedInternals.js
    import type Gio from 'gi://Gio';

    export class ExtensionBase {
        /**
         * @param {object} metadata - metadata passed in when loading the extension
        */
        constructor(metadata: ExtensionMetadata)

        /** the metadata.json file, parsed as JSON */
        readonly metadata: {
            'settings-schema': string,
            uuid: string,
            // …
        };

        /** the extension UUID */
        readonly uuid: string;
        /** the extension directory */
        readonly dir: Gio.File;
        /** the extension directory path */
        readonly path: string;

        /**
         * Get a GSettings object for schema, using schema files in
         * extensionsdir/schemas. If schema is omitted, it is taken
         * from metadata['settings-schema'].
         *
         * @param {string=} schema - the GSettings schema id
         *
         * @returns {Gio.Settings}
         */
        getSettings(schema?: string | undefined): Gio.Settings;

        /**
         * Initialize Gettext to load translations from extensionsdir/locale. If
         * domain is not provided, it will be taken from metadata['gettext-domain']
         * if provided, or use the UUID
         *
         * @param {string=} domain - the gettext domain to use
         */
        initTranslations(domain?: string | undefined): void;

        /**
         * Translate `str` using the extension's gettext domain
         *
         * @param {string} str - the string to translate
         *
         * @returns {string} the translated string
         */
        gettext(str: string): string;

        /**
         * Translate `str` and choose plural form using the extension's
         * gettext domain
         *
         * @param {string} str - the string to translate
         * @param {string} strPlural - the plural form of the string
         * @param {number} n - the quantity for which translation is needed
         *
         * @returns {string} the translated string
         */
        ngettext(str: string, strPlural: string, n: number): string;

        /**
         * Translate `str` in the context of `context` using the extension's
         * gettext domain
         *
         * @param {string} context - context to disambiguate `str`
         * @param {string} str - the string to translate
         *
         * @returns {string} the translated string
         */
        pgettext(context: string, str: string): string;

        /** lookup the extension object from any module by using the static method */
        static lookupByUUID(uuid: string): ExtensionBase | null;
        /** lookup the extension object from any module by using the static method */
        static lookupByURL(url: string): ExtensionBase | null;
    }
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
    import {ExtensionBase} from 'sharedInternals';

    /**
     * An object describing the extension and various properties available for extensions to use.
     *
     * Some properties may only be available in some versions of GNOME Shell, while others may not be meant for extension authors to use. All properties should be considered read-only.
     */
    export class Extension extends ExtensionBase {
        constructor(metadata: ExtensionMetadata) {
            super(metadata);
        }

        /** the extension type; `1` for system, `2` for user */
        readonly type: number;
        /** an error message or an empty string if no error */
        readonly error: string;
        /** whether the extension has a preferences dialog */
        readonly hasPrefs: boolean;
        /** whether the extension has a pending update */
        readonly hasUpdate: boolean;
        /** whether the extension can be enabled/disabled */
        readonly canChange: boolean;
        /** a list of supported session modes */
        readonly sessionModes: string[];

        /**
         * Open the extension's preferences window
         */
        openPreferences(): void;
    }
}

declare module 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js' {
    import type Adw from 'gi://Adw';
    import type Gtk from 'gi://Gtk';

    import {ExtensionBase} from 'sharedInternals';

    export class ExtensionPreferences extends ExtensionBase {
        constructor(metadata: ExtensionMetadata) {
            super(metadata);
        }

        /**
         * Fill the preferences window with preferences.
         *
         * The default implementation adds the widget
         * returned by getPreferencesWidget().
         *
         * @param {Adw.PreferencesWindow} window - the preferences window
         */
        fillPreferencesWindow(window: Adw.PreferencesWindow): void;

        /**
         * Get the single widget that implements
         * the extension's preferences.
         *
         * @returns {Gtk.Widget}
         */
        getPreferencesWidget(): Gtk.Widget;
    }
}
