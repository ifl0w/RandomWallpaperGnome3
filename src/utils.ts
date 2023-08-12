import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type Meta from 'gi://Meta';

import {DefaultWallpaperManager} from './manager/defaultWallpaperManager.js';
import {HydraPaper} from './manager/hydraPaper.js';
import {Logger} from './logger.js';
import {Superpaper} from './manager/superPaper.js';
import {Settings} from './settings.js';
import {type WallpaperManager} from './manager/wallpaperManager.js';

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
 * Get the string representation of an enum SourceType.
 *
 * @param {SourceType} value The enum value to request
 * @returns {string} Name of the corresponding source type
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
 * @returns {string} Filename part
 */
function fileName(uri: string): string {
    while (_isURIEncoded(uri))
        uri = decodeURIComponent(uri);

    let base = uri.substring(uri.lastIndexOf('/') + 1);
    if (base.indexOf('?') >= 0)
        base = base.substring(0, base.indexOf('?'));

    return base;
}

// https://stackoverflow.com/a/32859917
/**
 * Compare two strings and return the first char they differentiate.
 *
 * Begins counting on 0 and returns -1 if the strings are identical.
 *
 * @param {string} str1 String to compare
 * @param {string} str2 String to compare
 * @returns {number} First different char or -1
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
 * Get the amount of currently connected displays.
 *
 * @returns {number} Connected display count
 */
function getMonitorCount(): number {
    // FIXME: Figure out where the 'global' thing can be imported from
    // @ts-expect-error Figure out where the 'global' thing can be imported from
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const currentDisplay = global?.display as Meta.Display;
    const count = currentDisplay?.get_n_monitors();

    if (count)
        return count;

    new Logger('RWG3', 'Utils').warn('Unable to get monitor count!');
    return 1;
}

/**
 * Get a random number between 0 and a given value.
 *
 * @param {number} size Maximum
 * @returns {number} Random number between 0 and $size
 */
function getRandomNumber(size: number): number {
    // https://stackoverflow.com/a/5915122
    return Math.floor(Math.random() * size);
}

// https://stackoverflow.com/a/12646864
/**
 * Shuffle all entries in an array into random order.
 *
 * @param {T[]} array Array to shuffle
 * @returns {T[]} Shuffled array
 */
function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = getRandomNumber(i + 1);
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

/**
 * Check if a string is an URI.
 *
 * @param {string} uri The URI to check
 * @returns {boolean} Whether the given string is an URI
 */
function _isURIEncoded(uri: string): boolean {
    uri = uri || '';

    return uri !== decodeURIComponent(uri);
}

// https://stackoverflow.com/a/5767357
/**
 * Remove the first matching item of an array.
 *
 * @param {Array<T>} array Array of items
 * @param {T} value Item to remove
 * @returns {Array<T>} Array with first encountered item removed
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

/**
 * Get a wallpaper manager.
 *
 * Checks for HydraPaper first and then for Superpaper. Falls back to the default manager.
 *
 * @returns {WallpaperManager} Wallpaper manager, falls back to the default manager
 */
// This function is here instead of wallpaperManager.js to work around looping import errors
function getWallpaperManager(): WallpaperManager {
    const hydraPaper = new HydraPaper();
    if (hydraPaper.isAvailable())
        return hydraPaper;

    const superpaper = new Superpaper();
    if (superpaper.isAvailable())
        return superpaper;

    return new DefaultWallpaperManager();
}

/**
 * Check if a filename matches a merged wallpaper name.
 *
 * Merged wallpaper need special handling as these are single images
 * but span across all displays.
 *
 * @param {string} filename Naming to check
 * @returns {boolean} Whether the image is a merged wallpaper
 */
// This function is here instead of wallpaperManager.js to work around looping import errors
function isImageMerged(filename: string): boolean {
    return DefaultWallpaperManager.isImageMerged(filename) ||
        HydraPaper.isImageMerged(filename) ||
        Superpaper.isImageMerged(filename);
}

export {
    SourceType,
    getSourceTypeName,
    getWallpaperManager,
    isImageMerged,
    execCheck,
    fileName,
    findFirstDifference,
    getMonitorCount,
    getRandomNumber,
    removeItemOnce,
    setPictureUriOfSettingsObject,
    shuffleArray
};
