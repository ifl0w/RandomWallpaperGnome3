const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const Gettext = imports.gettext.domain('space.iflow.randomwallpaper');
//const _ = Gettext.gettext;

const RWG_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.space.iflow.randomwallpaper';

function init() {
    //Convenience.initTranslations();
}

function buildPrefsWidget() {
    let settings = new RandomWallpaperSettings();
    let widget = settings.widget;
    widget.show_all();

    return widget;
}

/* UI Setup */
const RandomWallpaperSettings = new Lang.Class({
    Name: 'RandomWallpaper.Settings',

    _init: function() {
      this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA);
      this._builder = new Gtk.Builder();
      //this._builder.set_translation_domain(Self.metadata['gettext-domain']);
      this._builder.add_from_file(Self.path + '/settings.ui');

      this._toggleAfSliders();

      this.widget = this._builder.get_object('main-widget');

      this._builder.get_object('af-switch').connect('notify::active', function(toggleSwitch) {
        this._toggleAfSliders();
      }.bind(this))

      this._settings.bind('history-length',
                          this._builder.get_object('history-length'),
                          'value',
                          Gio.SettingsBindFlags.DEFAULT);
      this._settings.bind('minutes',
                          this._builder.get_object('duration-minutes'),
                          'value',
                          Gio.SettingsBindFlags.DEFAULT);
      this._settings.bind('hours',
                          this._builder.get_object('duration-hours'),
                          'value',
                          Gio.SettingsBindFlags.DEFAULT);
      this._settings.bind('source',
                          this._builder.get_object('source-combo'),
                          'active-id',
                          Gio.SettingsBindFlags.DEFAULT);
      this._settings.bind('auto-fetch',
                          this._builder.get_object('af-switch'),
                          'active',
                          Gio.SettingsBindFlags.DEFAULT);
    },

    _toggleAfSliders: function() {
      if(this._builder.get_object('af-switch').active) {
        this._builder.get_object('duration-slider-hours').set_sensitive(true);
        this._builder.get_object('duration-slider-minutes').set_sensitive(true);
      } else {
        this._builder.get_object('duration-slider-hours').set_sensitive(false);
        this._builder.get_object('duration-slider-minutes').set_sensitive(false);
      }
    }

});
