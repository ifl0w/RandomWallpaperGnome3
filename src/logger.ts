// https://gitlab.gnome.org/GNOME/gjs/-/blob/master/doc/Logging.md

import {Settings} from './settings.js';

// Generated code produces a no-shadow rule error
/* eslint-disable */
enum LogLevel {
    SILENT,
    ERROR,
    WARNING,
    INFO,
    DEBUG,
}
/* eslint-enable */
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
        return this._settings.getInt('log-level') as LogLevel;
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

/**
 * Retrieve the human readable enum name.
 *
 * @param {LogLevel} level The mode to name
 * @returns {string} Name
 */
function _getLogLevelName(level: LogLevel): string {
    let name: string;

    switch (level) {
    case LogLevel.SILENT:
        name = 'Silent';
        break;
    case LogLevel.ERROR:
        name = 'Error';
        break;
    case LogLevel.WARNING:
        name = 'Warning';
        break;
    case LogLevel.INFO:
        name = 'Info';
        break;
    case LogLevel.DEBUG:
        name = 'Debug';
        break;

    default:
        name = 'LogLevel name not found';
        break;
    }

    return name;
}

/**
 * Get a list of human readable enum entries.
 *
 * @returns {string[]} Array with key names
 */
function getLogLevelNameList(): string[] {
    const list: string[] = [];

    const values = Object.values(LogLevel).filter(v => !isNaN(Number(v)));
    for (const i of values)
        list.push(_getLogLevelName(i as LogLevel));

    return list;
}

export {
    Logger,
    getLogLevelNameList
};
