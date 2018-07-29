const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Gtk = imports.gi.Gtk;

// Filesystem
const Gio = imports.gi.Gio;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const LoggerModule = Self.imports.logger;
const Timer = Self.imports.timer;

var HistoryElement = new Lang.Class({
	Name: 'HistoryElement',
	Extends: PopupMenu.PopupSubMenuMenuItem,
	logger: null,
	historyEntry: null,

	setAsWallpaperItem: null,
	previewItem: null,
	_previewActor: null,

	_init: function (historyEntry, index) {
		this.parent("", false);
		this.logger = new LoggerModule.Logger('RWG3', 'HistoryElement');

		let timestamp = historyEntry.timestamp;
		let date = new Date(timestamp);

		let timeString = date.toLocaleTimeString();
		let dateString = date.toLocaleDateString();

		let prefixText;
		if (index === 0) {
			prefixText = "Current Background";
		} else {
			prefixText = String(index) + '.';
		}
		this.prefixLabel = new St.Label({
			text: prefixText,
			style_class: 'rwg-history-index'
		});

		this.actor.insert_child_above(this.prefixLabel, this.label);
		this.label.destroy();

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

		this.historyEntry = historyEntry;
		this.actor.historyId = historyEntry.id; // extend the actor with the historyId

		if (index !== 0) {
			this.actor.insert_child_above(this._container, this.prefixLabel);
		}

		this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({can_focus: false, reactive: false})); // theme independent spacing
		this.menu.actor.add_style_class_name("rwg-history-element-content");

		if (this.historyEntry.source && this.historyEntry.source !== null) {
			if (this.historyEntry.source.author !== null
				&& this.historyEntry.source.authorUrl !== null) {
				this.authorItem = new PopupMenu.PopupMenuItem('Image By: ' + this.historyEntry.source.author);
				this.authorItem.connect('activate', () => {
					Util.spawn(['xdg-open', this.historyEntry.source.authorUrl]);
				});

				this.menu.addMenuItem(this.authorItem);
			}

			if (this.historyEntry.source.source !== null
				&& this.historyEntry.source.sourceUrl !== null) {
				this.sourceItem = new PopupMenu.PopupMenuItem('Image From: ' + this.historyEntry.source.source);
				this.sourceItem.connect('activate', () => {
					Util.spawn(['xdg-open', this.historyEntry.source.sourceUrl]);
				});

				this.menu.addMenuItem(this.sourceItem);
			}

			this.imageUrlItem = new PopupMenu.PopupMenuItem('Open Image In Browser');
			this.imageUrlItem.connect('activate', () => {
				Util.spawn(['xdg-open', this.historyEntry.source.imageLinkUrl]);
			});

			this.menu.addMenuItem(this.imageUrlItem);
		} else {
			this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Unknown source.'));
		}

		this.setAsWallpaperItem = new PopupMenu.PopupMenuItem('Set As Wallpaper');
		this.setAsWallpaperItem.connect('activate', () => {
			this.emit('activate');
		});

		this.previewItem = new PopupMenu.PopupBaseMenuItem({can_focus: false, reactive: false});
		this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({can_focus: false, reactive: false})); // theme independent spacing
		this.menu.addMenuItem(this.setAsWallpaperItem);
		this.menu.addMenuItem(this.previewItem);
		this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({can_focus: false, reactive: false})); // theme independent spacing

		/*
			Load the image on first opening of the sub menu instead of during creation of the history list.
		 */
		this.menu.connect('open-state-changed', (self, open) => {
			if (open) {
				if (this._previewActor !== null) {
					return;
				}

				try {
					let width = 250; // TODO: get width or add option in settings.
					let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(this.historyEntry.path, width, -1, true);
					let height = pixbuf.get_height();

					let image = new Clutter.Image();
					let pixelFormat = pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888;
					image.set_data(
						pixbuf.get_pixels(),
						pixelFormat,
						width,
						height,
						pixbuf.get_rowstride()
					);
					this._previewActor = new Clutter.Actor({height: height, width: width});
					this._previewActor.set_content(image);

					this.previewItem.actor.add_actor(this._previewActor);
				} catch (exeption) {
					this.logger.error(exeption);
				}
			}
		})
	}
});

var CurrentImageElement = new Lang.Class({
	Name: 'CurrentImageElement',
	Extends: HistoryElement,

	_init: function (historyElement) {
		this.parent(historyElement, 0);

		if (this.setAsWallpaperItem !== null) {
			this.setAsWallpaperItem.destroy();
		}
	}
});

/**
 * Element for the New Wallpaper button and the remaining time for the auto fetch
 * feature.
 * The remaining time will only be displayed if the af-feature is activated.
 *
 * @type {Lang.Class}
 */
var NewWallpaperElement = new Lang.Class({
	Name: 'NewWallpaperElement',
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function (params) {
		this.parent(params);

		this._timer = new Timer.AFTimer();

		this._container = new St.BoxLayout({
			vertical: true
		});

		this._newWPLabel = new St.Label({
			text: 'New Wallpaper',
			style_class: 'rwg-new-lable'
		});
		this._container.add_child(this._newWPLabel);

		this._remainingLabel = new St.Label({
			text: '1 minute remaining'
		});
		this._container.add_child(this._remainingLabel);

		this.actor.add_child(this._container);
	},

	show: function () {
		if (this._timer.isActive()) {
			let remainingMinutes = this._timer.remainingMinutes();
			let minutes = remainingMinutes % 60;
			let hours = Math.floor(remainingMinutes / 60);

			let hoursText = hours.toString();
			hoursText += (hours == 1) ? ' hour' : ' hours';
			let minText = minutes.toString();
			minText += (minutes == 1) ? ' minute' : ' minutes';

			if (hours >= 1) {
				this._remainingLabel.text = '... ' + hoursText + ' and ' + minText + ' remaining.'
			} else {
				this._remainingLabel.text = '... ' + minText + ' remaining.'
			}

			this._remainingLabel.show();
		} else {
			this._remainingLabel.hide();
		}
	}
});

var StatusElement = new Lang.Class({
	Name: 'StatusElement',
	Extends: St.Icon,

	_init: function () {

		this.parent({
			icon_name: 'preferences-desktop-wallpaper-symbolic',
			style_class: 'system-status-icon'
		});

		let _this = this;

		this.loadingTweenIn = {
			opacity: 20,
			time: 1,
			transition: 'easeInOutSine',
			onComplete: function () {
				Tweener.addTween(_this, _this.loadingTweenOut);
			}
		};

		this.loadingTweenOut = {
			opacity: 255,
			time: 1,
			transition: 'easeInOutSine',
			onComplete: function () {
				if (_this.isLoading) {
					Tweener.addTween(_this, _this.loadingTweenIn);
				} else {
					return false;
				}
				return true;
			}
		}

	},

	startLoading: function () {
		this.isLoading = true;
		Tweener.addTween(this, this.loadingTweenOut);
	},

	stopLoading: function () {
		this.isLoading = false;
		Tweener.removeTweens(this);
		this.opacity = 255;
	}

});

var HistorySection = new Lang.Class({
	Name: 'HistorySection',
	Extends: PopupMenu.PopupMenuSection,

	_init: function () {
		this.parent();

		this.actor = new St.ScrollView({
			hscrollbar_policy: Gtk.PolicyType.NEVER,
			vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
		});

		this.actor.add_actor(this.box);
	},

});

