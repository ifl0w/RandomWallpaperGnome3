const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;

//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const WallpaperController = Self.imports.wallpaperController;

const LoggerModule = Self.imports.logger;

// UI Imports
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const CustomElements = Self.imports.elements;
const Tweener = imports.ui.tweener;

const Timer = Self.imports.timer;

// Filesystem
const Gio = imports.gi.Gio;

// Settings
const Prefs = Self.imports.settings;

let wallpaperController;
let panelEntry;

let settings;
let hidePanelIconHandler = null;

function init(metaData) {
	settings = new Prefs.Settings();
	wallpaperController = new WallpaperController.WallpaperController();
}

function enable() {
	// enable Extension

	// UI
	panelEntry = new RandomWallpaperEntry(0, "Random wallpaper");

	// add to panel
	Main.panel.addToStatusArea("random-wallpaper-menu", panelEntry);

	hidePanelIconHandler = settings.observe('hide-panel-icon', updatePanelMenuVisibility);
	updatePanelMenuVisibility();
}

function disable() {
	// disable Extension
	panelEntry.destroy();

	// remove all signal handlers
	if (hidePanelIconHandler !== null) {
		settings.disconnect(hidePanelIconHandler);
	}

	// cleanup the timer singleton
	let timer = new Timer.AFTimer();
	timer.cleanup();
}

function updatePanelMenuVisibility(isVisible) {

	if (settings.get('hide-panel-icon', 'boolean')) {
		panelEntry.actor.hide();
	} else {
		panelEntry.actor.show();
	}

}

var RandomWallpaperEntry = new Lang.Class({
	Extends: PanelMenu.Button,
	Name: "RandomWallpaperEntry",
	logger: null,

	/**
	 * Cache HistoryElements for performance of long histories.
	 */
	_historySectionCache: {},

	_init: function (menuAlignment, nameText) {
		this.parent(menuAlignment, nameText);
		this.logger = new LoggerModule.Logger('RWG3', 'RandomWallpaperEntry');

		// Panelmenu Icon
		this.statusIcon = new CustomElements.StatusElement();
		this.actor.add_child(this.statusIcon);

		// new wallpaper button
		this.newWallpaperItem = new CustomElements.NewWallpaperElement();

		this.menu.addMenuItem(this.newWallpaperItem);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// current background section
		this.currentBackgroundSection = new PopupMenu.PopupMenuSection();
		this.menu.addMenuItem(this.currentBackgroundSection);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// history section
		this.historySection = new CustomElements.HistorySection();
		this.menu.addMenuItem(this.historySection);

		this.setHistoryList();

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// clear history button
		this.clearHistoryItem = new PopupMenu.PopupMenuItem('Clear History');
		this.menu.addMenuItem(this.clearHistoryItem);

		// open wallpaper folder button
		this.openFolder = new PopupMenu.PopupMenuItem('Open Wallpaper Folder');
		this.menu.addMenuItem(this.openFolder);

		// settings button
		this.openSettings = new PopupMenu.PopupMenuItem('Settings');
		this.menu.addMenuItem(this.openSettings);

		/*
			add eventlistener
		*/
		wallpaperController.registerStartLoadingHook(this.statusIcon.startLoading.bind(this.statusIcon));
		wallpaperController.registerStopLoadingHook(this.statusIcon.stopLoading.bind(this.statusIcon));
		wallpaperController.registerStopLoadingHook(this.setHistoryList.bind(this));

		// new wallpaper event
		this.newWallpaperItem.connect('activate', function () {
			wallpaperController.fetchNewWallpaper();
		});

		// clear history event
		this.clearHistoryItem.connect('activate', function () {
			wallpaperController.deleteHistory();
		});

		// Open Wallpaper Folder
		this.openFolder.connect('activate', function (event) {
			let uri = GLib.filename_to_uri(wallpaperController.wallpaperlocation, "");
			Gio.AppInfo.launch_default_for_uri(uri, global.create_app_launch_context(0, -1))
		});

		this.openSettings.connect("activate", function () {
			// call gnome settings tool for this extension
			let app = Shell.AppSystem.get_default().lookup_app("gnome-shell-extension-prefs.desktop");
			if (app != null) {
				// only works in Gnome >= 3.12
				let info = app.get_app_info();
				let timestamp = global.display.get_current_time_roundtrip();
				info.launch_uris([Self.uuid], global.create_app_launch_context(timestamp, -1));
			}
		});

		this.menu.actor.connect('show', function () {
			this.newWallpaperItem.show();
		}.bind(this));

		// when the popupmenu disapears, check if the wallpaper is the original and
		// reset it if needed
		this.menu.actor.connect('hide', () => {
			wallpaperController.resetWallpaper();
		});

		this.menu.actor.connect('leave-event', () => {
			wallpaperController.resetWallpaper();
		});

		settings.observe('history', this.setHistoryList.bind(this));
	},

	setCurrentBackgroundElement: function () {
		this.currentBackgroundSection.removeAll();

		let historyController = wallpaperController.getHistoryController();
		let history = historyController.history;

		if (history.length > 0) {
			let currentImage = new CustomElements.CurrentImageElement(history[0]);
			this.currentBackgroundSection.addMenuItem(currentImage);
		}
	},

	setHistoryList: function () {
		wallpaperController.update();
		this.setCurrentBackgroundElement();

		let historyController = wallpaperController.getHistoryController();
		let history = historyController.history;
		this.historySection.clearSection();

		if (history.length <= 1) {
			this.clearHistoryList();
			return;
		}

		let existingHistoryElements = [];
		for (let i = 1; i < history.length; i++) {
			let historyID = history[i].id;
			let tmp;

			if (!(historyID in this._historySectionCache)) {
				tmp = new CustomElements.HistoryElement(history[i], i);

				tmp.actor.connect('key-focus-in', onEnter);
				tmp.actor.connect('key-focus-out', onLeave);
				tmp.actor.connect('enter-event', onEnter);

				tmp.connect('activate', onSelect);
				this._historySectionCache[historyID] = tmp;
			} else {
				tmp = this._historySectionCache[historyID];
				tmp.setIndex(i);
			}

			existingHistoryElements.push(historyID)
			this.historySection.addMenuItem(tmp, i-1);
		}
		this._cleanupHistoryCache(existingHistoryElements);

		function onLeave(actor) {
			wallpaperController.resetWallpaper();
		}

		function onEnter(actor) {
			wallpaperController.previewWallpaper(actor.historyId);
		}

		function onSelect(actor) {
			wallpaperController.setWallpaper(actor.historyEntry.id);
		}

	},

	_cleanupHistoryCache: function(existingIDs) {
		let destroyIDs = Object.keys(this._historySectionCache).filter((i) => existingIDs.indexOf(i) === -1);

		destroyIDs.map(id => {
			delete this._historySectionCache[id];
		});
	},

	clearHistoryList: function () {
		this._cleanupHistoryCache([]);
		this.historySection.removeAll();

		let empty = new PopupMenu.PopupMenuItem('No recent wallpaper ...', {
			activate: false,
			hover: false,
			style_class: 'rwg-recent-lable',
			can_focus: false
		});
		this.historySection.addMenuItem(empty);
	},

});
