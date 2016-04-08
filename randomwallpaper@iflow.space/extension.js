const Lang = imports.lang;

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

		// when the popupmenu disapears, check if the wallpaper is the original and
		// reset it if needed
		this.menu.actor.connect('hide', function() {
			wallpaperController.setWallpaper(_this.history[0], true);
			_this.setHistoryList();
		});

		this.menu.actor.connect('leave-event', function() {
			wallpaperController.previewWallpaper(_this.history[0], 400, true);
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
			wallpaperController.previewWallpaper(history[0], 400, true);
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
			reactive: false,
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