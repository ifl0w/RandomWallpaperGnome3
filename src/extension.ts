//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const WallpaperController = Self.imports.wallpaperController;
const RandomWallpaperMenu = Self.imports.randomWallpaperMenu;
const LoggerModule = Self.imports.logger;

const Timer = Self.imports.timer;

let wallpaperController;
let panelMenu;
let logger;

function init(metaData) { }

function enable() {
	// enable Extension
	logger = new LoggerModule.Logger("RWG3", "Main");
	wallpaperController = new WallpaperController.WallpaperController();

	logger.info("Enable extension.");
	panelMenu = new RandomWallpaperMenu.RandomWallpaperMenu(wallpaperController);
	panelMenu.init();
}

function disable() {
	// disable Extension
	logger.info("Disable extension.");
	panelMenu.cleanup();

	// destroy timer singleton
	Timer.AFTimerDestroySingleton();

	// clear references
	wallpaperController = null;
	panelMenu = null;
	logger = null;
}
