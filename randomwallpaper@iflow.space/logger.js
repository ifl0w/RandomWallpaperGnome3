const Lang = imports.lang;

let Logger = new Lang.Class({
	Name: "Logger",
	_prefix: null,
	_callingClass: null,

	_init: function(prefix, callingClass) {
		this._prefix = prefix;
		this._callingClass = callingClass;
	},

	_log: function(level, message) {
		global.log(`${this._prefix} [${level}] >> ${this._callingClass} :: ${message}`);
	},

	debug: function (message) {
		this._log("DEBUG", message);
	},

	info: function (message) {
		this._log("INFO", message);
	},

	warn: function (message) {
		this._log("WARNING", message);
	},

	error: function (message) {
		this._log("ERROR", message);
	}
});