const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Self.imports.settings;
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
		this._settings = new Settings.Settings();

		let timestamp = historyEntry.timestamp;
		let date = new Date(timestamp);

		let timeString = date.toLocaleTimeString();
		let dateString = date.toLocaleDateString();

		let prefixText = String(index) + '.';
		this.prefixLabel = new St.Label({
			text: prefixText,
			style_class: 'rwg-history-index'
		});

		if (index === 0) {
			this.label.text = 'Current Background';
		} else {
			this.actor.insert_child_above(this.prefixLabel, this.label);
			this.label.destroy();
		}

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

		this.menu.actor.add_style_class_name("rwg-history-element-content");

		if (this.historyEntry.source !== null) {
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

		this.previewItem = new PopupMenu.PopupBaseMenuItem({ can_focus: false, reactive: false });
		this.menu.addMenuItem(this.previewItem);

		this.setAsWallpaperItem = new PopupMenu.PopupMenuItem('Set As Wallpaper');
		this.setAsWallpaperItem.connect('activate', () => {
			this.emit('activate', null); // Fixme: not sure what the second parameter should be. null seems to work fine for now.
		});

		if (index !== 0) {
			// this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({ can_focus: false, reactive: false })); // theme independent spacing
			this.menu.addMenuItem(this.setAsWallpaperItem);
		}

		this.copyToFavorites = new PopupMenu.PopupMenuItem('Save For Later');
		this.copyToFavorites.connect('activate', () => {
			this._saveImage();
		});
		this.menu.addMenuItem(this.copyToFavorites);

		// Static URLs can't block images (yet?)
		if (historyEntry.adapter.type !== 5) {
			this.blockImage = new PopupMenu.PopupMenuItem('Add To Blocklist');
			this.blockImage.connect('activate', () => {
				this._addToBlocklist(historyEntry);
			});
			this.menu.addMenuItem(this.blockImage);
		}

		/*
			Load the image on first opening of the sub menu instead of during creation of the history list.
		 */
		this.menu.connect('open-state-changed', (self, open) => {
			if (open) {
				if (this._previewActor !== null) {
					return;
				}

				try {
					let width = 270; // 270 looks good for the now fixed 350px menu width
					// let width = this.menu.actor.get_width(); // This should be correct but gives different results per element?
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
					this._previewActor = new Clutter.Actor({ height: height, width: width });
					this._previewActor.set_content(image);

					this.previewItem.actor.add_actor(this._previewActor);
				} catch (exeption) {
					this.logger.error(exeption);
				}
			}
		})
	}

	_addToBlocklist(element) {
		if (element.adapter.id === null || element.adapter.id === -1) {
			return;
		}

		let path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${element.adapter.id}/`;
		let generalSettings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);
		let blockedFilenames = generalSettings.get('blocked-images', 'strv');

		if (blockedFilenames.includes(element.name)) {
			return;
		}

		blockedFilenames.push(element.name);
		generalSettings.set('blocked-images', 'strv', blockedFilenames);
	}

	async _saveImage() {
		let sourceFile = Gio.File.new_for_path(this.historyEntry.path);
		let targetFolder = Gio.File.new_for_path(this._settings.get('favorites-folder', 'string'));
		let targetFile = targetFolder.get_child(this.historyEntry.name);
		let targetInfoFile = targetFolder.get_child(`${this.historyEntry.name}.json`);

		try {
			if (!targetFolder.make_directory_with_parents(null)) {
				this.logger.warn('Could not create directories.');
				return;
			}
		} catch (error) {
			if (error === Gio.IOErrorEnum.EXISTS) { }
		}

		try { // This try is for promise rejections. GJS mocks about missing this despite all examples omitting this try-catch-block
			let copyResult = await new Promise((resolve, reject) => {
				sourceFile.copy_async(targetFile, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, null, null, (file, result) => {
					try {
						resolve(file.copy_finish(result));
					} catch (e) {
						reject(e);
					}
				});
			});

			if (copyResult === false) {
				this.logger.warn('Failed copying image.');
				return;
			} else if (copyResult === Gio.IOErrorEnum.EXISTS) {
				this.logger.warn('Image already exists in location.');
				return;
			}

			let outputStream = await new Promise((resolve, reject) => {
				targetInfoFile.create_async(Gio.FileCreateFlags.NONE, GLib.PRIORITY_DEFAULT, null, (file, result) => {
					try {
						resolve(file.create_finish(result));
					} catch (error) {
						reject(error);
					}
				});
			});

			if (outputStream === null) {
				this.logger.warn('Failed creating info file.');
				return;
			}


			const data = JSON.stringify(this.historyEntry.source, null, '\t');
			let writeResult = await new Promise((resolve, reject) => {
				outputStream.write_all_async(data, GLib.PRIORITY_DEFAULT, null, (stream, result) => {
					try {
						resolve(stream.write_all_finish(result));
					} catch (error) {
						reject(error);
					}
				});
			});

			if (writeResult === false) {
				this.logger.warn('Failed writing info file.');
				// return;
			} else if (writeResult === true) {
				// return;
			}
			// writeResult is a number with bytes already written - ignore for now

			outputStream.close(); // Important! to flush the cache to the file
		} catch (error) {
			this.logger.warn(`Error saving image: ${error}`);
		}
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
			hoursText += (hours === 1) ? ' hour' : ' hours';
			let minText = minutes.toString();
			minText += (minutes === 1) ? ' minute' : ' minutes';

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

var StatusElement = class {

	constructor() {
		this.icon = new St.Icon({
			icon_name: 'preferences-desktop-wallpaper-symbolic',
			style_class: 'system-status-icon'
		});
	}

	startLoading() {
		this.icon.ease({
			opacity: 20,
			duration: 1337,
			mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
			autoReverse: true,
			repeatCount: -1
		});
	}

	stopLoading() {
		this.icon.remove_all_transitions();
		this.icon.opacity = 255;
	}

};

var HistorySection = class extends PopupMenu.PopupMenuSection {

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
