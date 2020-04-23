const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;

//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const LoggerModule = Self.imports.logger;
const Timer = Self.imports.timer;

// UI Imports
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const CustomElements = Self.imports.elements;
const Main = imports.ui.main;

// Filesystem
const Gio = imports.gi.Gio;

// Settings
const Prefs = Self.imports.settings;

var RandomWallpaperMenu = class {

	constructor(wallpaperController) {
		this.panelMenu = new PanelMenu.Button(0, "Random wallpaper");
		this.settings = new Prefs.Settings();
		this.wallpaperController = wallpaperController;
		this.logger = new LoggerModule.Logger('RWG3', 'RandomWallpaperEntry');
		this.hidePanelIconHandler = this.settings.observe('hide-panel-icon', this.updatePanelMenuVisibility.bind(this));

		// Panelmenu Icon
		this.statusIcon = new CustomElements.StatusElement();
		this.panelMenu.actor.add_child(this.statusIcon.icon);

		// new wallpaper button
		this.newWallpaperItem = new CustomElements.NewWallpaperElement();

		this.panelMenu.menu.addMenuItem(this.newWallpaperItem);

		this.panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// current background section
		this.currentBackgroundSection = new PopupMenu.PopupMenuSection();
		this.panelMenu.menu.addMenuItem(this.currentBackgroundSection);
		this.panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// history section
		this.historySection = new CustomElements.HistorySection();
		this.panelMenu.menu.addMenuItem(this.historySection);

		this.panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// clear history button
		this.clearHistoryItem = new PopupMenu.PopupMenuItem('Clear History');
		this.panelMenu.menu.addMenuItem(this.clearHistoryItem);

		// open wallpaper folder button
		this.openFolder = new PopupMenu.PopupMenuItem('Open Wallpaper Folder');
		this.panelMenu.menu.addMenuItem(this.openFolder);

		// settings button
		this.openSettings = new PopupMenu.PopupMenuItem('Settings');
		this.panelMenu.menu.addMenuItem(this.openSettings);

		/*
			add eventlistener
		*/
		this.wallpaperController.registerStartLoadingHook(this.statusIcon.startLoading.bind(this.statusIcon));
		this.wallpaperController.registerStopLoadingHook(this.statusIcon.stopLoading.bind(this.statusIcon));
		this.wallpaperController.registerStopLoadingHook(this.setHistoryList.bind(this));

		// new wallpaper event
		this.newWallpaperItem.connect('activate', () => {
			this.wallpaperController.fetchNewWallpaper();
		});

		// clear history event
		this.clearHistoryItem.connect('activate', () => {
			this.wallpaperController.deleteHistory();
		});

		// Open Wallpaper Folder
		this.openFolder.connect('activate', (event) => {
			let uri = GLib.filename_to_uri(this.wallpaperController.wallpaperlocation, "");
			Gio.AppInfo.launch_default_for_uri(uri, global.create_app_launch_context(0, -1))
		});

		this.openSettings.connect("activate", () => {
			Gio.DBus.session.call(
				'org.gnome.Shell.Extensions',
				'/org/gnome/Shell/Extensions',
				'org.gnome.Shell.Extensions',
				'OpenExtensionPrefs',
				new GLib.Variant('(ssa{sv})', [Self.uuid, '', {}]),
				null,
				Gio.DBusCallFlags.NONE,
				-1,
				null);
		});

		this.panelMenu.menu.actor.connect('show', () => {
			this.newWallpaperItem.show();
		});

		// when the popupmenu disapears, check if the wallpaper is the original and
		// reset it if needed
		this.panelMenu.menu.actor.connect('hide', () => {
			this.wallpaperController.resetWallpaper();
		});

		this.panelMenu.menu.actor.connect('leave-event', () => {
			this.wallpaperController.resetWallpaper();
		});

		this.settings.observe('history', this.setHistoryList.bind(this));
	}

	init() {
		this.updatePanelMenuVisibility();
		this.setHistoryList();

		// add to panel
		Main.panel.addToStatusArea("random-wallpaper-menu", this.panelMenu);
	}

	cleanup() {
		this.clearHistoryList();
		this.panelMenu.destroy();

		// remove all signal handlers
		if (this.hidePanelIconHandler !== null) {
			this.settings.disconnect(this.hidePanelIconHandler);
		}
	}

	updatePanelMenuVisibility() {
		if (this.settings.get('hide-panel-icon', 'boolean')) {
			this.panelMenu.actor.hide();
		} else {
			this.panelMenu.actor.show();
		}
	}

	setCurrentBackgroundElement() {
		this.currentBackgroundSection.removeAll();

		let historyController = this.wallpaperController.getHistoryController();
		let history = historyController.history;

		if (history.length > 0) {
			let currentImage = new CustomElements.CurrentImageElement(history[0]);
			this.currentBackgroundSection.addMenuItem(currentImage);
		}
	}

	setHistoryList() {
		this.wallpaperController.update();
		this.setCurrentBackgroundElement();

		let historyController = this.wallpaperController.getHistoryController();
		let history = historyController.history;

		if (history.length <= 1) {
			this.clearHistoryList();
			return;
		}

		function onLeave(actor) {
			this.wallpaperController.resetWallpaper();
		}

		function onEnter(actor) {
			this.wallpaperController.previewWallpaper(actor.historyId);
		}

		function onSelect(actor) {
			this.wallpaperController.setWallpaper(actor.historyEntry.id);
		}

		this.historySection.updateList(history, onEnter.bind(this), onLeave.bind(this), onSelect.bind(this));
	}

	clearHistoryList() {
		this.historySection.clear();
	}

};
