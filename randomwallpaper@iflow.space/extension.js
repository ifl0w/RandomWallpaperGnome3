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

// Filesystem
const Gio = imports.gi.Gio;

// Settings
const Convenience = Self.imports.convenience;

let wallpaperController;
let extensionMeta;

function init(metaData) {
	extensionMeta = metaData;
	wallpaperController = new WallpaperController.WallpaperController(metaData);
}

let panelEntry;

let RandomWallpaperEntry = new Lang.Class({
	Extends: PanelMenu.Button,
	Name: "RandomWallpaperEntry",
	logger: null,

	_init: function(menuAlignment, nameText) {
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
		this.historySection = new PopupMenu.PopupMenuSection();
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
		this.newWallpaperItem.connect('activate', function() {
			wallpaperController.fetchNewWallpaper();
		});

		// clear history event
		this.clearHistoryItem.connect('activate', function() {
			wallpaperController.deleteHistory();
		});

		// Open Wallpaper Folder
		this.openFolder.connect('activate', function(event) {
			let uri = GLib.filename_to_uri(wallpaperController.wallpaperlocation, "");
			Gio.AppInfo.launch_default_for_uri(uri, global.create_app_launch_context(0, -1))
		});

		this.openSettings.connect("activate", function(){
			// call gnome settings tool for this extension
			let app = Shell.AppSystem.get_default().lookup_app("gnome-shell-extension-prefs.desktop");
			if( app!=null ) {
				// only works in Gnome >= 3.12
				let info = app.get_app_info();
				let timestamp = global.display.get_current_time_roundtrip();
				info.launch_uris([Self.uuid], global.create_app_launch_context(timestamp, -1));
			}
		});

		this.menu.actor.connect('show', function() {
			this.newWallpaperItem.show();
			wallpaperController.menuShowHook();
		}.bind(this));

		// when the popupmenu disapears, check if the wallpaper is the original and
		// reset it if needed
		this.menu.actor.connect('hide', () => {
			wallpaperController.resetWallpaper();
			this.setHistoryList(); // TODO: move this call to a new background changed hook (because overhead on close)
		});

		this.menu.actor.connect('leave-event', () => {
			wallpaperController.resetWallpaper();
		});

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

	setHistoryList: function() {
		this.setCurrentBackgroundElement();

		this.historySection.removeAll();

		let historyController = wallpaperController.getHistoryController();
		let history = historyController.history;

		if (history.length <= 1) {
			this.clearHistoryList();
			return;
		}

		for (let i = 1; i < history.length; i++) {
			let historyid = history[i].id;
			let tmp = new CustomElements.HistoryElement(history[i], i);

			tmp.actor.connect('key-focus-in', onEnter);
			tmp.actor.connect('key-focus-out', onLeave);
			tmp.actor.connect('enter-event', onEnter);

			tmp.connect('activate', onSelect);

			this.historySection.addMenuItem(tmp);
		}

		let _this = this;

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

	clearHistoryList: function() {
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

function enable() {
	// Extension enabled

	// UI
	panelEntry = new RandomWallpaperEntry(0, "Random wallpaper");

	// add to panel
	Main.panel.addToStatusArea("random-wallpaper-menu", panelEntry);
}

function disable() {
	// Extension disabled
	panelEntry.destroy();
}
