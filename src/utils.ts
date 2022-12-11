import * as Gdk from 'gi://Gdk';
import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';

/**
 * Returns a promise which resolves cleanly or rejects according to the underlying subprocess.
 *
 * @param {string[]} argv String array of command and parameter
 * @param {Gio.Cancellable} [cancellable] Object to cancel the command later in lifetime
 */
function execCheck(argv: string[], cancellable?: Gio.Cancellable | null) {
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
function fileName(uri: string) {
    while (_isURIEncoded(uri))
        uri = decodeURIComponent(uri);


    let base = uri.substring(uri.lastIndexOf('/') + 1);
    if (base.indexOf('?') >= 0)
        base = base.substring(0, base.indexOf('?'));

    return base;
}

// https://stackoverflow.com/a/32859917
/**
 *
 * @param {string} str1 String to compare
 * @param {string} str2 String to compare
 */
function findFirstDifference(str1: string, str2: string) {
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
function getMonitorCount() {
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
    // FIXME: wrong version in definition
    // @ts-expect-error
    return defaultDisplay.get_n_monitors();
}

/**
 *
 * @param {number} size Maximum
 */
function getRandomNumber(size: number) {
    // https://stackoverflow.com/a/5915122
    return Math.floor(Math.random() * size);
}

/**
 *
 * @param {string} uri The URI to check
 */
function _isURIEncoded(uri: string) {
    uri = uri || '';

    return uri !== decodeURIComponent(uri);
}

// https://stackoverflow.com/a/5767357
/**
 *
 * @param {Array<T>} array Array of items
 * @param {T} value Item to remove
 */
function removeItemOnce<T>(array: T[], value: T) {
    const index = array.indexOf(value);
    if (index > -1)
        array.splice(index, 1);

    return array;
}

export {
    getMonitorCount,
    getRandomNumber,
    execCheck,
    findFirstDifference,
    fileName,
    removeItemOnce
};
