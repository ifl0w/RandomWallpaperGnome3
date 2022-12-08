// TODO: use an enum once moved to TS
const LOG_LEVEL = {
    SILENT: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
};

// TODO: add UI option or at least ENV variable (this is a quick workaround to conform to extension review requirements)
const CURRENT_LOG_LEVEL = LOG_LEVEL.WARN;

class Logger {
    private _prefix: string;
    private _callingClass: string;

    constructor(prefix: string, callingClass: string) {
        this._prefix = prefix;
        this._callingClass = callingClass;
    }

    private _log(level: string, message: unknown) {
        log(`${this._prefix} [${level}] >> ${this._callingClass} :: ${message}`);
    }

    debug(message: string) {
        if (CURRENT_LOG_LEVEL < LOG_LEVEL.DEBUG)
            return;

        this._log('DEBUG', message);
    }

    info(message: string) {
        if (CURRENT_LOG_LEVEL < LOG_LEVEL.INFO)
            return;

        this._log('INFO', message);
    }

    warn(message: string) {
        if (CURRENT_LOG_LEVEL < LOG_LEVEL.WARN)
            return;

        this._log('WARNING', message);
    }

    error(message: string) {
        if (CURRENT_LOG_LEVEL < LOG_LEVEL.ERROR)
            return;

        this._log('ERROR', message);
    }
}

export {Logger};
