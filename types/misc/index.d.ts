/* eslint-disable */

declare module 'extensionUtils' {
    // https://github.com/yilozt/rounded-window-corners/blob/main/%40imports/misc/extensionUtils.d.ts
    // GPL3

    import Gio from 'gi://Gio';

    /**
     * getCurrentExtension:
     *
     * @returns {?object} - The current extension, or null if not called from
     * an extension.
     */
    export function getCurrentExtension(): {
        uuid: string,
        path: string,
        dir: Gio.File,
        metadata: {
            'settings-schema': string,
            uuid: string,
        }
    };
    /**
     * initTranslations:
     * @param {string=} domain - the gettext domain to use
     *
     * Initialize Gettext to load translations from extensionsdir/locale.
     * If @domain is not provided, it will be taken from metadata['gettext-domain']
     */
    export function initTranslations(domain?: string | undefined): void;
    /**
     * gettext:
     * @param {string} str - the string to translate
     *
     * Translate @str using the extension's gettext domain
     *
     * @returns {string} - the translated string
     *
     */
    export function gettext(str: string): string;
    /**
     * ngettext:
     * @param {string} str - the string to translate
     * @param {string} strPlural - the plural form of the string
     * @param {number} n - the quantity for which translation is needed
     *
     * Translate @str and choose plural form using the extension's
     * gettext domain
     *
     * @returns {string} - the translated string
     *
     */
    export function ngettext(str: string, strPlural: string, n: number): string;
    /**
     * pgettext:
     * @param {string} context - context to disambiguate @str
     * @param {string} str - the string to translate
     *
     * Translate @str in the context of @context using the extension's
     * gettext domain
     *
     * @returns {string} - the translated string
     *
     */
    export function pgettext(context: string, str: string): string;
    export function callExtensionGettextFunc(func: any, ...args: any[]): any;
    /**
     * getSettings:
     * @param {string?} schema - the GSettings schema id
     * @returns {Gio.Settings} - a new settings object for @schema
     *
     * Builds and returns a GSettings schema for @schema, using schema files
     * in extensionsdir/schemas. If @schema is omitted, it is taken from
     * metadata['settings-schema'].
     */
    export function getSettings(schema?: string | undefined): Gio.Settings;
    /**
     * openPrefs:
     *
     * Open the preference dialog of the current extension
     */
    export function openPrefs(): Promise<void>;
    export function isOutOfDate(extension: any): boolean;
    export function serializeExtension(extension: any): {};
    export function deserializeExtension(variant: any): {
        metadata: {};
    };
    export function installImporter(extension: any): void;
    export const Gettext: any;
    export const Config: any;
    export namespace ExtensionType {
        const SYSTEM: number;
        const PER_USER: number;
    }
    export namespace ExtensionState {
        const ENABLED: number;
        const DISABLED: number;
        const ERROR: number;
        const OUT_OF_DATE: number;
        const DOWNLOADING: number;
        const INITIALIZED: number;
        const UNINSTALLED: number;
    }
    export const SERIALIZED_PROPERTIES: string[];
}

declare interface GjsMiscImports {
    extensionUtils: typeof import('extensionUtils');
}

// extend imports interface with misc elements
declare interface GjsImports {
    misc: GjsMiscImports;
}
