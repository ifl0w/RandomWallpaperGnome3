const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Prefs = Self.imports.settings;

let AFTimer = new Lang.Class({

    _timeout: null,
    _timoutEndCallback: null,

    _init: function() {
        this._settings = new Prefs.Settings();
        // this._settings.observe('minutes_elapsed', function() { // TODO: determine what to do });
        this._settings.observe('minutes', this._loadSettings.bind(this));
    }

    _remainingMinutes: function() {
        // TODO
    }

    registerCallback: function(callback) {
        this._timoutEndCallback = callback;
    },

    begin: function() {
        if (this._timeout) {
            this.pause();
        }

        //this._settings.get()

        // TODO: calc elapsed time
        // TODO: check > 0

        this._timeout = GLib.timeout_add(Glib.PRIORITY_DEFAULT, delay, function() {
            this._settings.set(minutes_elapsed)
        }.bind(this));
    },

    stop: function() {
        if (_timeout) {
            Glib.source_remove(_timeout)
            this._settings.set('minutes_elapsed', 'int', 0)
        }
    },

    pause: function() {
        if (_timeout) {
            Glib.source_remove(_timeout)
            this._settings.set('minutes_elapsed', 'int', this._remainingMinutes())
        }
    }

});
