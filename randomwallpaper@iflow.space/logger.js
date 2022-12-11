// TODO: use an enum once moved to TS
const LOG_LEVEL = {
	SILENT: 0,
	ERROR: 1,
	WARN: 2,
	INFO: 3,
	DEBUG: 4,
}

// TODO: add UI option or at least ENV variable (this is a quick workaround to conform to extension review requirements)
const CURRENT_LOG_LEVEL = LOG_LEVEL.WARN;

var Logger = class {

	constructor(prefix, callingClass) {
		this._prefix = prefix;
		this._callingClass = callingClass;
	}

	_log(level, message) {
		log(this._prefix + ' [' + level + '] >> ' + this._callingClass + ' :: ' + message);
	}

	debug(message) {
		if (CURRENT_LOG_LEVEL < LOG_LEVEL.DEBUG)
			return;

		this._log('DEBUG', message);
	}

	info(message) {
		if (CURRENT_LOG_LEVEL < LOG_LEVEL.INFO)
			return;

		this._log('INFO', message);
	}

	warn(message) {
		if (CURRENT_LOG_LEVEL < LOG_LEVEL.WARN)
			return;

		this._log('WARNING', message);
	}

	error(message) {
		if (CURRENT_LOG_LEVEL < LOG_LEVEL.ERROR)
			return;

		this._log('ERROR', message);
	}

};
