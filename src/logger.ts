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

const LOG_PREFIX = 'RandomWallpaper';

/**
 * A convenience logger class.
 */
class Logger {
    public static SETTINGS: Settings | null = null;

    /**
     * Helper function to safely log to the console.
     *
     * @param {LogLevel} level the selected log level
     * @param {unknown} message Message to send, ideally an Error() or string
     * @param {object} sourceInstance Object where the log originates from (i.e., the source context)
     */
    private static _log(level: LogLevel, message: unknown, sourceInstance?: object): void {
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
     * Requires the static SETTINGS member to be set first.
     * Falls back to LogLevel.WARNING if settings object is not set.
     *
     * @returns {LogLevel} Log level
     */
    private static _selectedLogLevel(): LogLevel {
        if (Logger.SETTINGS === null) {
            this._log(LogLevel.ERROR, 'Extension context not set before first use!', Logger);
            return LogLevel.WARNING;
        }

        return Logger.SETTINGS.getInt('log-level');
    }

    /**
     * Log a DEBUG message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     * @param {object} sourceInstance Object where the log originates from (i.e., the source context)
     */
    static debug(message: unknown, sourceInstance?: object): void {
        Logger._log(LogLevel.DEBUG, message, sourceInstance);
    }

    /**
     * Log an INFO message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     * @param {object} sourceInstance Object where the log originates from (i.e., the source context)
     */
    static info(message: unknown, sourceInstance?: object): void {
        Logger._log(LogLevel.INFO, message, sourceInstance);
    }

    /**
     * Log a WARN message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     * @param {object} sourceInstance Object where the log originates from (i.e., the source context)
     */
    static warn(message: unknown, sourceInstance?: object): void {
        Logger._log(LogLevel.WARNING, message, sourceInstance);
    }

    /**
     * Log an ERROR message.
     *
     * @param {unknown} message Message to send, ideally an Error() or string
     * @param {object} sourceInstance Object where the log originates from (i.e., the source context)
     */
    static error(message: unknown, sourceInstance?: object): void {
        Logger._log(LogLevel.ERROR, message, sourceInstance);
    }

    /**
     * Get a list of human readable enum entries.
     *
     * @returns {string[]} Array with key names
     */
    static getLogLevelNameList(): string[] {
        const list: string[] = [];

        const values = Object.values(LogLevel).filter(v => !isNaN(Number(v)));
        for (const i of values)
            list.push(`${LogLevel[i as number]}`);

        return list;
    }

    /**
     * Remove references hold by this class
     */
    static destroy(): void {
        // clear reference to settings object
        Logger.SETTINGS = null;
    }
}

export {
    Logger
};
