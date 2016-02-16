const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Slider = imports.ui.slider;
const Tweener = imports.ui.tweener;

const HistoryElement = new Lang.Class({
	Name: 'HistoryElement',
	Extends: PopupMenu.PopupBaseMenuItem,
	historyId: null,

	_init: function(historyId, index, params) {
		index = String(index)+'.' || '0.';

		this.parent(params);

		let timestamp = parseInt(historyId.slice(0, historyId.lastIndexOf('.')));
		let date = new Date(timestamp);

		let timeString = date.toLocaleTimeString();
		let  dateString = date.toLocaleDateString();

		this.label = new St.Label({ 
			text: index,
			style_class: 'rwg-history-index'
		});
		this.actor.add_child(this.label);

		this._container = new St.BoxLayout({
			vertical: true
		});

		this.dateLabel = new St.Label({ 
			text: dateString,
			style_class: 'rwg-history-date'
		});
		this._container.add_child(this.dateLabel);

		this.timeLabel = new St.Label({ 
			text: timeString,
			style_class: 'rwg-history-time'
		});
		this._container.add_child(this.timeLabel);

		this.historyId = historyId;

		this.actor.add_child(this._container);
	}
});

const StatusElement = new Lang.Class({
	Name: 'StatusElement',
	Extends: St.Icon,
	
	_init: function() {
		
		this.parent({
			icon_name: 'preferences-desktop-wallpaper-symbolic',
			style_class: 'rwg_system_status_icon'
		});

		let _this = this;

		this.loadingTweenIn = {
			opacity:20, 
			time:1, 
			transition:'easeInOutSine',
			onComplete: function() {
				Tweener.addTween(_this, _this.loadingTweenOut);
			}
		}

		this.loadingTweenOut = {
			opacity:255, 
			time:1, 
			transition:'easeInOutSine',
			onComplete: function() {
				if (_this.isLoading) {
					Tweener.addTween(_this, _this.loadingTweenIn);
				} else {
					return false;					
				}
				return true;
			}
		}

	},

	startLoading: function() {
		this.isLoading = true;
		Tweener.addTween(this, this.loadingTweenOut);
	},

	stopLoading: function() {
		this.isLoading = false;
		Tweener.removeTweens(this);
		this.opacity = 255;
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