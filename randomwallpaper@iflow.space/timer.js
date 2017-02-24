const Lang = imports.lang;
const GLib = imports.gi.GLib;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Prefs = Self.imports.settings;

let _afTimerInstance = null;

// Singleton implementation of _AFTimer
let AFTimer = function() {
    if (!_afTimerInstance) {
        _afTimerInstance = new _AFTimer();
    }
    return _afTimerInstance;
};

/**
 * Timer for the auto fetch feature.
 *
 * TODO: find way to store elapsed time on shutdown/logout/gnome-shell-restart/etc.
 * @type {Lang}
 */
let _AFTimer = new Lang.Class({
    Name: 'AFTimer',

    _timeout: null,
    _timoutEndCallback: null,
    _timestamp: null,

    _init: function() {
        this._settings = new Prefs.Settings();
    },

    /**
     * Side effect is that the elapsed minutes will be stored in the GSettings.
     */
    _minutesElapsed: function() {
        let timestamp = this._timestamp;
        if (!timestamp) {
            return 0;
        }

        let now = new Date().getTime();
        let elapsed = this._settings.get('minutes-elapsed', 'int');

        let diffMin = Math.floor((now-timestamp)/(60*1000));

        if (diffMin >= 1) {
            elapsed += diffMin;
            this._settings.set('minutes-elapsed', 'int', elapsed);
            this._timestamp += diffMin*60*1000;
        }

        return elapsed;
    },

    isActive: function () {
        return this._settings.get('auto-fetch', 'boolean');
    },

    remainingMinutes: function() {
        let hours = this._settings.get('hours', 'int');
        let minutes = hours * 60 + this._settings.get('minutes', 'int');
        let minutesElapsed = this._minutesElapsed();

        return (minutes - minutesElapsed);
    },

    registerCallback: function(callback) {
        this._timoutEndCallback = callback;
    },

    /**
     * Starts a new timer.
     *
     * @return void
     */
    begin: function() {
        this.end(); // stop any running timer

        this._timestamp = new Date().getTime();

        let millisToWait = this.remainingMinutes() * 60 * 1000;
        if (millisToWait <= 0) {
            return;
        }

        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, millisToWait, function() {
            this.end();
            if (this._timoutEndCallback) {
                this._timoutEndCallback();
            }
            this.begin(); // restart timer
        }.bind(this));
    },

    /**
     * Stop the timer and set elapsed minutes to 0.
     *
     * @return void
     */
    end: function() {
        this._settings.set('minutes-elapsed', 'int', 0);
        if (this._timeout) {
            GLib.source_remove(this._timeout)
            this._timeout = null;
        }
    },

    // currently not used
    pause: function() {
        if (this._timeout) {
            GLib.source_remove(this._timeout)
            this._minutesElapsed();
        }
    }

});
