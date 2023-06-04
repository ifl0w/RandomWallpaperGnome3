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

/**
 *
 */
class Logger {
    private _prefix: string;
    private _callingClass: string;
    private _settings = new Settings();

    /**
     * Create a new logging helper.
     *
     * @param {string} prefix Custom string to prepend
     * @param {string} callingClass Class this logger writes messages for
     */
    constructor(prefix: string, callingClass: string) {
        this._prefix = prefix;
        this._callingClass = callingClass;
    }

    /**
     * Helper function to safely log to the console.
     *
     * @param {LogLevelStrings} level String representation of the selected log level
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    private _log(level: LogLevelStrings, message: unknown): void {
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

    /**
     * Get the log level selected by the user.
     *
     * @returns {LogLevel} Log level
     */
    private _selectedLogLevel(): LogLevel {
        return this._settings.getEnum('log-level');
    }

    /**
     * Log a DEBUG message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    debug(message: unknown): void {
        if (this._selectedLogLevel() < LogLevel.DEBUG)
            return;

        this._log('DEBUG', message);
    }

    /**
     * Log an INFO message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    info(message: unknown): void {
        if (this._selectedLogLevel() < LogLevel.INFO)
            return;

        this._log('INFO', message);
    }

    /**
     * Log a WARN message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    warn(message: unknown): void {
        if (this._selectedLogLevel() < LogLevel.WARNING)
            return;

        this._log('WARNING', message);
    }

    /**
     * Log an ERROR message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    error(message: unknown): void {
        if (this._selectedLogLevel() < LogLevel.ERROR)
            return;

        this._log('ERROR', message);
    }
}

export {Logger};
