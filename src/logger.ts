// https://gitlab.gnome.org/GNOME/gjs/-/blob/master/doc/Logging.md

import {Settings} from './settings.js';

const enum LogLevel {
    SILENT,
    ERROR,
    WARNING,
    INFO,
    DEBUG,
}
type LogLevelStrings = keyof typeof LogLevel;

class Logger {
    private _prefix: string;
    private _callingClass: string;
    private _settings = new Settings();

    constructor(prefix: string, callingClass: string) {
        this._prefix = prefix;
        this._callingClass = callingClass;
    }

    private _log(level: LogLevelStrings, message: unknown) {
        let errorMessage = String(message);

        if (message instanceof Error)
            errorMessage = message.message;

        // This logs messages with GLib.LogLevelFlags.LEVEL_MESSAGE
        log(`${this._prefix} [${level}] >> ${this._callingClass} :: ${errorMessage}`);

        // Log stack trace if available
        if (message instanceof Error && message.stack)
            // This logs messages with GLib.LogLevelFlags.LEVEL_WARNING
            logError(message);
    }

    private _selectedLogLevel() {
        return this._settings.getEnum('log-level');
    }

    debug(message: unknown) {
        if (this._selectedLogLevel() < LogLevel.DEBUG)
            return;

        this._log('DEBUG', message);
    }

    info(message: unknown) {
        if (this._selectedLogLevel() < LogLevel.INFO)
            return;

        this._log('INFO', message);
    }

    warn(message: unknown) {
        if (this._selectedLogLevel() < LogLevel.WARNING)
            return;

        this._log('WARNING', message);
    }

    error(message: unknown) {
        if (this._selectedLogLevel() < LogLevel.ERROR)
            return;

        this._log('ERROR', message);
    }
}

export {Logger};
