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
	global.log("INIT");
}

let panelEntry;

let RandomWallpaperEntry = new Lang.Class({
	Extends: PanelMenu.Button,
	Name: "RandomWallpaperEntry",

	_init: function(menuAlignment, nameText) {
		this.parent(menuAlignment, nameText);

		//let gicon = Gio.Icon.new_for_string(extensionMeta.path + "/images/shuffle-icon.svg");

		/*let icon = new St.Icon({ 
		gicon: gicon,
		style_class: 'rwg_status_icon' 
	});*/

		this.statusIcon = new CustomElements.StatusElement();
		this.actor.add_child(this.statusIcon);

		let newWallpaperItem = new PopupMenu.PopupMenuItem('New Wallpaper', {
			style_class: 'rwg-new-lable'
		});

		this.menu.addMenuItem(newWallpaperItem, 1);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		this.historySection = new PopupMenu.PopupMenuSection();
		this.menu.addMenuItem(this.historySection);

		this.setHistoryList();

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		//this.menu.addMenuItem(new CustomElements.DelaySlider(60));

		// add eventlistener
		let _this = this;
		newWallpaperItem.actor.connect('button-press-event', function() {
			_this.statusIcon.startLoading();
			wallpaperController.fetchNewWallpaper(function() {
				_this.statusIcon.stopLoading();
				_this.setHistoryList();
			});
		});

		// when the popupmenu disapears, check if the wallpaper is the original and
		// reset it if needed
		this.menu.actor.connect('hide', function() {
			wallpaperController.setWallpaper(_this.history[0]);
			_this.setHistoryList();
		});
	},

	setHistoryList: function() {
		this.historySection.removeAll();

		let history = this.history = wallpaperController.getHistory();

		if (!history.length) {
			this.clearHistory();
		};

		for (var i = 1; i < history.length; i++) {
			let historyid = history[i];
			let tmp = new CustomElements.HistoryElement(historyid, i);

			tmp.actor.connect('key-focus-in', function(actor) {
				wallpaperController.previewWallpaper(historyid);
			});

			tmp.actor.connect('button-press-event', function(actor) {
				wallpaperController.setWallpaper(historyid);
			});

			tmp.actor.connect('button-press-event', function(actor) {
				wallpaperController.setWallpaper(historyid);
			});

			this.historySection.addMenuItem(tmp);
		};

	},


	clearHistory: function() {
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
	global.log("ENABLE");

	// UI
	panelEntry = new RandomWallpaperEntry(0, "Random wallpaper");

	// add to panel
	Main.panel.addToStatusArea("random-wallpaper-menu", panelEntry);
}

function disable() {
	global.log("DISABLE");
	panelEntry.destroy();
}