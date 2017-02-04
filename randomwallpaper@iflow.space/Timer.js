const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Convenience = Self.imports.convenience;

let AFTimer = new Lang.Class({

  _timeout: null,
  _timoutEndCallback: null,

  _init: function() {
    this._settings = Convenience.getSettings();
    this._settings.connect('changed::minutes_elapsed', this._loadSettings.bind(this));
    this._settings.connect('changed::minutes_', this._loadSettings.bind(this));
  }

  registerCallback: function(callback) {
    this._timoutEndCallback = callback;
  }

  start: function(delay) {
    if (this._timeout) {
      this.stop();
    }

    // TODO: calc elapsed time
    // TODO: check > 0

    this._timeout = GLib.timeout_add(, delay, function() {

    });
  }

  stop: function(delay, callback) {
    if (_timeout) {
      Glib.source_remove(_timeout)
    }
  }

});
