import * as Adw from '@gi-types/adw1';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {Settings} from './settings.js';

// Generated code produces a no-shadow rule error:
// 'SourceType' is already declared in the upper scope on line 7 column 5  no-shadow
/* eslint-disable */
enum SourceType {
    UNSPLASH = 0,
    WALLHAVEN,
    REDDIT,
    GENERIC_JSON,
    LOCAL_FOLDER,
    STATIC_URL,
}
/* eslint-enable */

/**
 *
 * @param {SourceType} value The enum value to request
 */
function getSourceTypeName(value: SourceType): string {
    switch (value) {
    case SourceType.UNSPLASH:
        return 'Unsplash';
    case SourceType.WALLHAVEN:
        return 'Wallhaven';
    case SourceType.REDDIT:
        return 'Reddit';
    case SourceType.GENERIC_JSON:
        return 'Generic JSON';
    case SourceType.LOCAL_FOLDER:
        return 'Local Folder';
    case SourceType.STATIC_URL:
        return 'Static URL';

    default:
        return 'Unsplash';
    }
}

/**
 * Returns a promise which resolves cleanly or rejects according to the underlying subprocess.
 *
 * @param {string[]} argv String array of command and parameter
 * @param {Gio.Cancellable} [cancellable] Object to cancel the command later in lifetime
 */
function execCheck(argv: string[], cancellable?: Gio.Cancellable | null): Promise<void> {
    let cancelId = 0;
    const proc = new Gio.Subprocess({
        argv,
        flags: Gio.SubprocessFlags.NONE,
    });

    // This does not take "undefined" despite the docs saying otherwise
    proc.init(cancellable ?? null);

    if (cancellable instanceof Gio.Cancellable)
        cancelId = cancellable.connect(() => proc.force_exit());

    return new Promise<void>((resolve, reject) => {
    // This does not take "undefined" despite the docs saying otherwise
        proc.wait_check_async(cancellable ?? null, (_proc, res) => {
            if (_proc === null) {
                reject(new Error('Failed getting process.'));
                return;
            }

            try {
                if (!_proc.wait_check_finish(res)) {
                    const status = _proc.get_exit_status();

                    throw new Gio.IOErrorEnum({
                        code: Gio.io_error_from_errno(status).code,
                        message: GLib.strerror(status),
                    });
                }

                resolve();
            } catch (e) {
                reject(e);
            } finally {
                if (cancellable instanceof Gio.Cancellable && cancelId > 0)
                    cancellable.disconnect(cancelId);
            }
        });
    });
}

/**
 * Retrieves the file name part of an URI
 *
 * @param {string} uri URI to scan
 */
function fileName(uri: string): string {
    while (_isURIEncoded(uri))
        uri = decodeURIComponent(uri);

    let base = uri.substring(uri.lastIndexOf('/') + 1);
    if (base.indexOf('?') >= 0)
        base = base.substring(0, base.indexOf('?'));

    return base;
}

/**
 *
 * @param {Adw.ComboRow} comboRow ComboRow to fill and connect
 * @param {Settings} settings Settings schema to scan values for
 * @param {string} key Key where to find values in the settings schema
 */
function fillComboRowFromEnum(comboRow: Adw.ComboRow, settings: Settings, key: string): void {
    // Fill combo from settings enum
    const availableTypes = settings.getSchema().get_key(key).get_range(); // GLib.Variant (sv)
    // (sv) = Tuple(%G_VARIANT_TYPE_STRING, %G_VARIANT_TYPE_VARIANT)
    // s should be 'enum'
    // v should be an array enumerating the possible values. Each item in the array is a possible valid value and no other values are valid.
    // v is 'as'
    const availableTypesNames = availableTypes.get_child_value(1).get_variant().get_strv();

    const stringList = Gtk.StringList.new(availableTypesNames);
    comboRow.model = stringList;
    comboRow.selected = settings.getEnum(key);

    comboRow.connect('notify::selected', (_comboRow: Adw.ComboRow) => {
        settings.setEnum(key, _comboRow.selected);
    });
}

// https://stackoverflow.com/a/32859917
/**
 *
 * @param {string} str1 String to compare
 * @param {string} str2 String to compare
 */
function findFirstDifference(str1: string, str2: string): number {
    let i = 0;
    if (str1 === str2)
        return -1;
    while (str1[i] === str2[i])
        i++;
    return i;
}

/**
 *
 */
function getMonitorCount(): number {
    // Gdk 4.8+
    // Gdk.DisplayManager.get()
    // displayManager.get_default_display()
    // display.get_monitors()
    // monitors.get_n_items() <- Monitor count, number

    // let defaultDisplay = Gdk.Display.get_default(); // default "seat" which can have multiple monitors
    // let monitorList = defaultDisplay.get_monitors(); // Gio.ListModel containing all "Gdk.Monitor"
    // return monitorList.get_n_items();

    // Gdk < 4.8
    const defaultDisplay = Gdk.Display.get_default();

    if (!defaultDisplay)
        return 1;

    // FIXME: wrong version in definition
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return defaultDisplay.get_n_monitors() as number;
}

/**
 *
 * @param {number} size Maximum
 */
function getRandomNumber(size: number): number {
    // https://stackoverflow.com/a/5915122
    return Math.floor(Math.random() * size);
}

/**
 *
 * @param {string} uri The URI to check
 */
function _isURIEncoded(uri: string): boolean {
    uri = uri || '';

    return uri !== decodeURIComponent(uri);
}

// https://stackoverflow.com/a/5767357
/**
 *
 * @param {Array<T>} array Array of items
 * @param {T} value Item to remove
 */
function removeItemOnce<T>(array: T[], value: T): T[] {
    const index = array.indexOf(value);
    if (index > -1)
        array.splice(index, 1);

    return array;
}

/**
 * Set the picture-uri property of the given settings object to the path.
 * Precondition: the settings object has to be a valid Gio settings object with the picture-uri property.
 *
 * @param {Settings} settings The settings schema object containing the keys to change
 * @param {string} uri The picture URI to be set
 */
function setPictureUriOfSettingsObject(settings: Settings, uri: string): void {
    /*
     * inspired from:
     * https://bitbucket.org/LukasKnuth/backslide/src/7e36a49fc5e1439fa9ed21e39b09b61eca8df41a/backslide@codeisland.org/settings.js?at=master
     */
    const setProp = (property: string): void => {
        if (settings.isWritable(property)) {
            // Set a new Background-Image (should show up immediately):
            settings.setString(property, uri);
        } else {
            throw new Error(`Property not writable: ${property}`);
        }
    };

    const availableKeys = settings.listKeys();

    let property = 'picture-uri';
    if (availableKeys.indexOf(property) !== -1)
        setProp(property);


    property = 'picture-uri-dark';
    if (availableKeys.indexOf(property) !== -1)
        setProp(property);
}

export {
    SourceType,
    getSourceTypeName,
    execCheck,
    fileName,
    fillComboRowFromEnum,
    findFirstDifference,
    getMonitorCount,
    getRandomNumber,
    removeItemOnce,
    setPictureUriOfSettingsObject
};
