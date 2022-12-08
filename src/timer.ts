const GLib = imports.gi.GLib;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Prefs = Self.imports.settings;
const LoggerModule = Self.imports.logger;

let _afTimerInstance = null;

// Singleton implementation of _AFTimer
var AFTimer = function () {
	if (!_afTimerInstance) {
		_afTimerInstance = new _AFTimer();
	}
	return _afTimerInstance;
};

var AFTimerDestroySingleton = function () {
	// ensure timer is removed
	if (_afTimerInstance != null) {
		_afTimerInstance.cleanup();
	}

	// clear reference
	_afTimerInstance = null;
}

/**
 * Timer for the auto fetch feature.
 */
var _AFTimer = class {

	constructor() {
		this.logger = new LoggerModule.Logger('RWG3', 'Timer');

		this._timeout = null;
		this._timoutEndCallback = null;
		this._minutes = 30;

		this._settings = new Prefs.Settings();
	}

	isActive() {
		return this._settings.get('auto-fetch', 'boolean');
	}

	remainingMinutes() {
		let minutesElapsed = this._minutesElapsed();
		let remainder = minutesElapsed % this._minutes;
		return Math.max(this._minutes - remainder, 0);
	}

	registerCallback(callback) {
		this._timoutEndCallback = callback;
	}

	/**
	 * Sets the minutes of the timer.
	 *
	 * @param minutes
	 */
	setMinutes(minutes) {
		this._minutes = minutes;
	}

	/**
	 * Start the timer.
	 *
	 * @return void
	 */
	start() {
		this.cleanup();

		let last = this._settings.get('timer-last-trigger', 'int64');
		if (last === 0) {
			this.reset();
		}

		let millisRemaining = this.remainingMinutes() * 60 * 1000;

		// set new wallpaper if the interval was surpassed and set the timestamp to when it should have been updated
		if (this._surpassedInterval()) {
			if (this._timoutEndCallback) {
				this._timoutEndCallback();
			}
			let millisOverdue = (this._minutes * 60 * 1000) - millisRemaining;
			this._settings.set('timer-last-trigger', 'int64', Date.now() - millisOverdue);
		}

		// actual timer function
		this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, millisRemaining, () => {
			if (this._timoutEndCallback) {
				this._timoutEndCallback();
			}

			this.reset(); // reset timer
			this.start(); // restart timer
		});
	}

	/**
	 * Stop the timer.
	 *
	 * @return void
	 */
	stop() {
		this._settings.set('timer-last-trigger', 'int64', 0);
		this.cleanup();
	}

	/**
	 * Cleanup the timeout callback if it exists.
	 *
	 * @return void
	 */
	cleanup() {
		if (this._timeout) { // only remove if a timeout is active
			GLib.source_remove(this._timeout);
			this._timeout = null;
		}
	}

	/**
	 * Reset the timer.
	 *
	 * @return void
	 */
	reset() {
		this._settings.set('timer-last-trigger', 'int64', new Date().getTime());
		this.cleanup();
	}

	_minutesElapsed() {
		let now = Date.now();
		let last = this._settings.get('timer-last-trigger', 'int64');

		if (last === 0) {
			return 0;
		}

		let elapsed = Math.max(now - last, 0);
		return Math.floor(elapsed / (60 * 1000));
	}

	_surpassedInterval() {
		let now = Date.now();
		let last = this._settings.get('timer-last-trigger', 'int64');
		let diff = now - last;
		let intervalLength = this._minutes * 60 * 1000;

		return diff > intervalLength;
	}

};
