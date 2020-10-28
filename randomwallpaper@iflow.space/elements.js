const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const LoggerModule = Self.imports.logger;
const Timer = Self.imports.timer;

var HistoryElement = GObject.registerClass({
			 GTypeName: 'HistoryElement',
	 }, class HistoryElement extends PopupMenu.PopupSubMenuMenuItem {
				_init(historyEntry, index) {
		super._init("", false);
		this.logger = new LoggerModule.Logger('RWG3', 'HistoryElement');
		this.historyEntry = null;
		this.setAsWallpaperItem = null;
		this.previewItem = null;
		this._previewActor = null;

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
			this.emit('activate', null); // Fixme: not sure what the second parameter should be. null seems to work fine for now.
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

	setIndex(index) {
		this.prefixLabel.set_text(String(index));
	}
	 }
);

var CurrentImageElement = GObject.registerClass({
			 GTypeName: 'CurrentImageElement',
	 }, class CurrentImageElement extends HistoryElement {

	_init(historyElement) {
		super._init(historyElement, 0);

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
var NewWallpaperElement = GObject.registerClass({
			 GTypeName: 'NewWallpaperElement',
	 }, class NewWallpaperElement extends PopupMenu.PopupBaseMenuItem {

	_init(params) {
		super._init(params);

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
	}

	show() {
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

class StatusElement {

	constructor() {
		this.icon = new St.Icon({
			icon_name: 'preferences-desktop-wallpaper-symbolic',
			style_class: 'system-status-icon'
		});

		let _this = this;

		this.loadingTweenIn = {
			opacity: 20,
			duration: 1500,
			mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
			autoReverse: true,
			repeatCount: -1
		};

	}

	startLoading() {
		this.icon.ease(this.loadingTweenIn);
	}

	stopLoading() {
		this.icon.remove_all_transitions();
		this.icon.opacity = 255;
	}

};

class HistorySection extends PopupMenu.PopupMenuSection {

	constructor() {
		super();

		/**
		 * Cache HistoryElements for performance of long histories.
		 */
		this._historySectionCache = {};

		this._historyCache = [];

		this.actor = new St.ScrollView({
			hscrollbar_policy: Gtk.PolicyType.NEVER,
			vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
		});

		this.actor.add_actor(this.box);
	}

	updateList(history, onEnter, onLeave, onSelect) {
		if (this._historyCache.length <= 1) {
			this.removeAll(); // remove empty history element
		}

		let existingHistoryElements = [];

		for (let i = 1; i < history.length; i++) {
			let historyID = history[i].id;
			let tmp;

			if (!(historyID in this._historySectionCache)) {
				tmp = new HistoryElement(history[i], i);

				tmp.actor.connect('key-focus-in', onEnter);
				tmp.actor.connect('key-focus-out', onLeave);
				tmp.actor.connect('enter-event', onEnter);

				tmp.connect('activate', onSelect);
				this._historySectionCache[historyID] = tmp;

				this.addMenuItem(tmp, i - 1);
			} else {
				tmp = this._historySectionCache[historyID];
				tmp.setIndex(i);
			}

			existingHistoryElements.push(historyID);
		}

		this._cleanupHistoryCache(existingHistoryElements);
		this._historyCache = history;
	}

	_cleanupHistoryCache(existingIDs) {
		let destroyIDs = Object.keys(this._historySectionCache).filter((i) => existingIDs.indexOf(i) === -1);

		destroyIDs.map(id => {
			this._historySectionCache[id].destroy();
			delete this._historySectionCache[id];
		});
	}

	clear() {
		this._cleanupHistoryCache([]);
		this.removeAll();
		this.addMenuItem(
			new PopupMenu.PopupMenuItem('No recent wallpaper ...', {
				activate: false,
				hover: false,
				style_class: 'rwg-recent-lable',
				can_focus: false
			})
		);

		this._historyCache = [];
	}

};
