const Lang = imports.lang;

//self
const Self = imports.misc.extensionUtils.getCurrentExtension();
const WallpaperController = Self.imports.wallpaperController;

// UI Imports
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

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

  _init: function(menuAlignment, nameText){
    this.parent(menuAlignment, nameText);

    let gicon = Gio.Icon.new_for_string(extensionMeta.path + "/images/shuffle-icon.svg");

    let icon = new St.Icon({ 
      gicon: gicon,
      style_class: 'system-status-icon' 
    });

    this.actor.add_child(icon);

    let menu_item = new PopupMenu.PopupMenuItem('Change Background');

    this.menu.addMenuItem(menu_item, 0);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Test Item'));
    this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Test Item'));
    this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Test Item'));

    // add eventlistener
    menu_item.actor.connect('button-press-event', function() {
      wallpaperController._requestRandomImage();
    });
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