const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;

//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const WallpaperController = Self.imports.wallpaperController;

// UI Imports
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const CustomElements = Self.imports.Elements;
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

	_init: function(menuAlignment, nameText) {
		this.parent(menuAlignment, nameText);

		// Panelmenu Icon
		this.statusIcon = new CustomElements.StatusElement();
		this.actor.add_child(this.statusIcon);

		// new wallpaper button
		this.newWallpaperItem = new PopupMenu.PopupMenuItem('New Wallpaper', {
			style_class: 'rwg-new-lable'
		});

		this.menu.addMenuItem(this.newWallpaperItem);

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

		//this.menu.addMenuItem(new CustomElements.DelaySlider(60));

		/*
			add eventlistener
		*/

		let _this = this;
		// new wallpaper event
		this.newWallpaperItem.connect('activate', function() {
			_this.statusIcon.startLoading();
			wallpaperController.fetchNewWallpaper(function() {
				_this.setHistoryList();
				_this.statusIcon.stopLoading();
			});
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

		this.menu.actor.connect('show', function() {
			wallpaperController.menuShowHook();
		});

		// when the popupmenu disapears, check if the wallpaper is the original and
		// reset it if needed
		this.menu.actor.connect('hide', function() {
			wallpaperController.resetWallpaper();
			_this.setHistoryList();
		});

		this.menu.actor.connect('leave-event', function(e, t, a) {
			wallpaperController.resetWallpaper();
		});

	},

	setHistoryList: function() {
		this.historySection.removeAll();

		let history = this.history = wallpaperController.getHistory();

		if (history.length <= 1) {
			this.clearHistoryList();
			return;
		};

		for (var i = 1; i < history.length; i++) {
			let historyid = history[i];
			let tmp = new CustomElements.HistoryElement(historyid, i);

			tmp.actor.connect('key-focus-in', onEnter);
			tmp.actor.connect('key-focus-out', onLeave);
			tmp.actor.connect('enter-event', onEnter);

			tmp.connect('activate', onSelect);

			this.historySection.addMenuItem(tmp);
		};

		function onLeave(actor) {
			wallpaperController.resetWallpaper();
		}

		function onEnter(actor) {
			wallpaperController.previewWallpaper(actor.historyId);
		}

		function onSelect(actor) {
			wallpaperController.setWallpaper(actor.historyId);
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
	this.settings = Convenience.getSettings();

	// UI
	panelEntry = new RandomWallpaperEntry(0, "Random wallpaper");

	// add to panel
	Main.panel.addToStatusArea("random-wallpaper-menu", panelEntry);
}

function disable() {
	// Extension disabled
	panelEntry.destroy();
}
