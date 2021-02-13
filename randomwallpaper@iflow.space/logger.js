var Logger = class {

	constructor(prefix, callingClass) {
		this._prefix = prefix;
		this._callingClass = callingClass;
	}

	_log(level, message) {
		log(this._prefix + ' [' + level + '] >> ' + this._callingClass + ' :: ' + message);
	}

	debug(message) {
		this._log('DEBUG', message);
	}

	info(message) {
		this._log('INFO', message);
	}

	warn(message) {
		this._log('WARNING', message);
	}

	error(message) {
		this._log('ERROR', message);
	}

};
