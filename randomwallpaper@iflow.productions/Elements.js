const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Slider = imports.ui.slider;

const Controls = new Lang.Class({
	Name: 'Controls',
	Extends: PopupMenu.PopupBaseMenuItem,
	_init: function() {
		this.parent();
		
	}
});

// -------------------------------------------------------------------------------

// borrowed from: https://github.com/eonpatapon/gnome-shell-extensions-mediaplayer
const SliderItem = new Lang.Class({
    Name: 'SliderItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(value) {
        this.parent();

        this._box = new St.Table({style_class: 'slider-item'});

        this._slider = new Slider.Slider(value);

        this._box.add(this._slider.actor, {row: 0, col: 2, x_expand: true});
        this.actor.add(this._box, {span: -1, expand: true});
    },

    setValue: function(value) {
        this._slider.setValue(value);
    },

    getValue: function() {
        return this._slider._getCurrentValue();
    },

    setIcon: function(icon) {
        this._icon.icon_name = icon + '-symbolic';
    },

    connect: function(signal, callback) {
        this._slider.connect(signal, callback);
    }
});


/**
 * Widget for setting the delay for the next Wallpaper-change.
 * @type {Lang.Class}
 */
const DelaySlider = new Lang.Class({
    Name: 'DelaySlider',
    Extends: SliderItem,

    _MINUTES_MAX: 59,
    _MINUTES_MIN: 5,
    _HOURS_MAX: 48,
    _HOURS_MIN: 1,

    /**
     * Construct a new Widget.
     * @private
     */
    _init: function(minutes){
        this.parent(0, ''); // value MUST be specified!
        this.setMinutes(minutes); // Set the real value.
    },

    /**
     * Set the value of the slider to x minutes.
     * @param minutes the value in minutes between _MINUTES_MAX and _MINUTES_MIN
     */
    setMinutes: function(minutes){
        // Validate:
        if (isNaN(minutes) || minutes < this._MINUTES_MIN || minutes > this._HOURS_MAX*60){
            throw TypeError("'minutes' should be an integer between "
                +this._MINUTES_MIN+" and "+this._HOURS_MAX*60);
        }

        let value = 0;
        if (minutes <= this._MINUTES_MAX){
            value = (minutes - this._MINUTES_MIN) / (this._MINUTES_MAX - this._MINUTES_MIN) / 2;
        } else {
            value = (((minutes / 60) - this._HOURS_MIN) / (this._HOURS_MAX - this._HOURS_MIN) / 2) + 0.5;
        }

        this.setValue(value);
    },

    /**
     * Get the value in minutes from the slider.
     * @return int the value in minutes.
     */
    getMinutes: function(){
        let minutes = 0;
        if (this.getValue() < 0.5) {
            minutes = this._MINUTES_MIN + (this.getValue() * 2) * (this._MINUTES_MAX - this._MINUTES_MIN);
        } else {
            minutes = (this._HOURS_MIN + (this.getValue() - 0.5) * 2 * (this._HOURS_MAX - this._HOURS_MIN)) * 60;
        }

        return (minutes < this._MINUTES_MIN) ? this._MINUTES_MIN : Math.floor(minutes);
    }
});

// -------------------------------------------------------------------------------