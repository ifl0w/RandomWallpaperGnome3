const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;

const Self = imports.misc.extensionUtils.getCurrentExtension();
//const Convenience = Self.imports.convenience;

//const Gettext = imports.gettext.domain('space.iflow.randomwallpaper');
//const _ = Gettext.gettext;

/* Settings Keys */
const SETTINGS_HIDE_CORNERS = 'hide-corners';
const SETTINGS_TRANSITION_SPEED = 'transition-speed';
const SETTINGS_FORCE_ANIMATION = 'force-animation';
const SETTINGS_UNMAXIMIZED_OPACITY = 'unmaximized-opacity';
const SETTINGS_MAXIMIZED_OPACITY = 'maximized-opacity';
const SETTINGS_PANEL_COLOR = 'panel-color';

/* Color Scaling Factor (Byte to Decimal) */
const SCALE_FACTOR = 255.9999999;

function init() {
    // Convenience.initTranslations();
}

function buildPrefsWidget() {
    let widget = new RandomWallpaperSettingsWidget();
    widget.show_all();

    return widget;
}

/* UI Setup */
const RandomWallpaperSettingsWidget = new Lang.Class({
    Name: 'RandomWallpaper.Prefs.SettingsUI',
    GTypeName: 'RandomWallpaperSettingsWidget',
    Extends: Gtk.Grid,

    _init: function(params) {
        this.parent(params);
       
        this.margin = this.row_spacing = this.column_spacing = 20;

        //this._settings = Convenience.getSettings();

        let i = 0;

        this.attach(new Gtk.Label({ label: 'Poll Sensors Every (sec)', halign : Gtk.Align.END}), 0, i++, 1, 1);
        let updateTime = Gtk.SpinButton.new_with_range (1, 60, 1);
        this.attach(updateTime, 1, i++, 1, 1);
        // this._settings.bind('update-time', updateTime, 'value', Gio.SettingsBindFlags.DEFAULT);

        let adjustment = new Gtk.Adjustment({
            lower: 10,
            upper: 60,
            step_increment: 1
        });
        let scale = new Gtk.HScale({
            digits:2,
            adjustment: adjustment,
            value_pos: Gtk.PositionType.RIGHT
        });

        this.add(scale);

        this._addSwitch({key : 'group-voltage', y : i++, x : 2,
            label : 'Group Voltage Items',
            help : "Works if you have more than three voltage sensors"});

        /*
        this._addComboBox({
            items : {
                'none' : 'None',
                'nvidia-settings' : 'NVIDIA',
                'aticonfig' : 'Catalyst',
                'bumblebee-nvidia-smi': 'Bumblebee + NVIDIA' },
            key: 'gpu-utility', y : i, x : 2,
            label: 'Video Card Temperature Utility'
        }); */

    },

    _addSwitch : function(params){
        let lbl = new Gtk.Label({label: params.label,halign : Gtk.Align.END});
        this.attach(lbl, params.x, params.y, 1, 1);
        let sw = new Gtk.Switch({halign : Gtk.Align.END, valign : Gtk.Align.CENTER});
        this.attach(sw, params.x + 1, params.y, 1, 1);
        if(params.help){
            lbl.set_tooltip_text(params.help);
            sw.set_tooltip_text(params.help);
        }
        //this._settings.bind(params.key, sw, 'active', Gio.SettingsBindFlags.DEFAULT);
    },

    _addComboBox : function(params){
        let model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

        let combobox = new Gtk.ComboBox({model: model});
        let renderer = new Gtk.CellRendererText();
        combobox.pack_start(renderer, true);
        combobox.add_attribute(renderer, 'text', 1);

        for(let k in params.items){
            model.set(model.append(), [0, 1], [k, params.items[k]]);
        }

        //combobox.set_active(Object.keys(params.items).indexOf(this._settings.get_string(params.key)));
        
        combobox.connect('changed', Lang.bind(this, function(entry) {
            let [success, iter] = combobox.get_active_iter();
            if (!success)
                return;
            //this._settings.set_string(params.key, model.get_value(iter, 0))
        }));

        this.attach(new Gtk.Label({ label: params.label, halign : Gtk.Align.END}), params.x, params.y, 1, 1);
        this.attach(combobox, params.x + 1, params.y, 1, 1);
    }
});