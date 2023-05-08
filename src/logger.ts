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

const LOG_PREFIX = 'RandomWallpaper';
const SETTINGS = new Settings();

/**
 *
 */
class Logger {
    /**
     * Helper function to safely log to the console.
     *
     * @param {LogLevelStrings} level String representation of the selected log level
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    private static _log(level: LogLevel, message: unknown, sourceInstance?: Object) {
        if (Logger._selectedLogLevel() < level)
            return;

        let errorMessage = String(message);

        if (message instanceof Error)
            errorMessage = message.message;

        let sourceName = '';
        if (sourceInstance)
            sourceName = ` >> ${sourceInstance.constructor.name}`;

        // This logs messages with GLib.LogLevelFlags.LEVEL_MESSAGE
        log(`${LOG_PREFIX} [${LogLevel[level]}]${sourceName} :: ${errorMessage}`);

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
    private static _selectedLogLevel(): LogLevel {
        return SETTINGS.getEnum('log-level');
    }

    /**
     * Log a DEBUG message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    static debug(message: unknown, sourceInstance?: Object) {
        Logger._log(LogLevel.DEBUG, message, sourceInstance);
    }

    /**
     * Log an INFO message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    static info(message: unknown, sourceInstance?: Object) {
        Logger._log(LogLevel.INFO, message, sourceInstance);
    }

    /**
     * Log a WARN message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    static warn(message: unknown, sourceInstance?: Object) {
        Logger._log(LogLevel.WARNING, message, sourceInstance);
    }

    /**
     * Log an ERROR message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     */
    static error(message: unknown, sourceInstance?: Object) {
        Logger._log(LogLevel.ERROR, message, sourceInstance);
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
