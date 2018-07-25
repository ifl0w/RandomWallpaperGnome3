const Lang = imports.lang;
const GLib = imports.gi.GLib;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Prefs = Self.imports.settings;
const LoggerModule = Self.imports.logger;

let _afTimerInstance = null;

// Singleton implementation of _AFTimer
var AFTimer = function() {
    if (!_afTimerInstance) {
        _afTimerInstance = new _AFTimer();
    }
    return _afTimerInstance;
};

/**
 * Timer for the auto fetch feature.
 *
 * @type {Lang}
 */
var _AFTimer = new Lang.Class({
    Name: 'AFTimer',

    _timeout: null,
    _timoutEndCallback: null,
    _minutes: 30,

    _init: function() {
        this._settings = new Prefs.Settings();
    },

    isActive: function () {
        return this._settings.get('auto-fetch', 'boolean');
    },

    remainingMinutes: function() {
        let minutesElapsed = this._minutesElapsed();
        let diff = this._minutes - minutesElapsed;
        return Math.max(diff, 0);
    },

    registerCallback: function(callback) {
        this._timoutEndCallback = callback;
    },

    /**
     * Starts a new timer with the given minutes.
     *
     * @param minutes
     * @return void
     */
    start: function(minutes) {
        this.cleanup();

        this._minutes = minutes;
        let lastChanged = this._settings.get('timer-last-trigger', 'int64');
        if (lastChanged === 0) {
            this.reset();
        }

        let millisToWait = this.remainingMinutes() * 60 * 1000;
        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, millisToWait, () => {
            if (this._timoutEndCallback) {
                this._timoutEndCallback();
            }

            this._settings.set('timer-last-trigger', 'int64', new Date().getTime());

            this.start(minutes); // restart timer
        });
    },

    /**
     * Stop the timer and set elapsed minutes to 0.
     *
     * @return void
     */
    stop: function() {
        this._settings.set('timer-last-trigger', 'int64', 0);
        this.cleanup();
    },

    /**
     * Cleanup the timeout callback if it exists.
     *
     * @return void
     */
    cleanup: function() {
        if (this._timeout) { // only remove if a timeout is active
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
    },

    /**
     * Reset the timer.
     *
     * @return void
     */
    reset: function() {
        this._settings.set('timer-last-trigger', 'int64', new Date().getTime());
        this.cleanup();
    },

    _minutesElapsed: function() {
        let now = new Date().getTime();
        let lastChanged = this._settings.get('timer-last-trigger', 'int64');

        if (lastChanged === 0) {
            return 0;
        }

        let elapsed = Math.max(now - lastChanged, 0);
        return Math.floor(elapsed / (60 * 1000));
    }

});
