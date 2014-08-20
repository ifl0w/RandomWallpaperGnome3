const Lang = imports.lang;

// UI Imports
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

// network requests
const Soup = imports.gi.Soup;
const Json = imports.gi.Json;

// Filesystem
const Gio = imports.gi.Gio;

let button;

function init() {
  // UI
  let icon = new St.Icon({ icon_name: 'system-run-symbolic',
                           style_class: 'system-status-icon' });
  
  button = new PanelMenu.Button(0, "Random wallpaper");
  button.actor.add_child(icon);
  let menu_item = new PopupMenu.PopupMenuItem('Change Background')
  button.menu.addMenuItem(menu_item, 0);
  button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  button.menu.addMenuItem(new PopupMenu.PopupMenuItem('trolololol'));

  // add eventlistener
  menu_item.actor.connect('button-press-event', _requestRandomImage);
}

// fetch a random image url from desktopper.cc
function _requestRandomImage(){
  let session = new Soup.SessionAsync();
  let message = Soup.Message.new('GET', 'https://api.desktoppr.co/1/wallpapers/random')
  
  let parser = new Json.Parser();

  session.queue_message(message, function(session, message) {
    parser.load_from_data(message.response_body.data, -1);
    
    let data = parser.get_root().get_object()
    let response = data.get_object_member('response');
    let imageUrl = response.get_object_member('image').get_string_member('url');

    _writeToFile(imageUrl);
  });
}

let counter = 0;
// copy file from uri to local direcotry
function _writeToFile(uri){
  let output_file = Gio.file_new_for_path("temp"+counter);
  let input_file = Gio.file_new_for_uri(uri);
  let fstream = input_file.copy(output_file, Gio.FileCopyFlags.OVERWRITE, null, function(){
  }, function(){
  });  

  _setBackground(output_file.get_path());
}


function _setBackground(path){
  let background_setting = new Gio.Settings({schema: "org.gnome.desktop.background"});
  
  global.log("Current Background-Image: "+ background_setting.get_string("picture-uri"));
  // Set:
  if (background_setting.is_writable("picture-uri")){
      // Set a new Background-Image (should show up immediately):
      if (background_setting.set_string("picture-uri", "file://"+path) ){
          background_setting.apply();
          Gio.Settings.sync(); // Necessary: http://stackoverflow.com/questions/9985140
          counter++;
      } else {

      }
  } else {

  }
}

function enable() {
  global.log("ENABLE");
  Main.panel.addToStatusArea("random-wallpaper-menu", button);
}

function disable() {
  global.log("DISABLE");
  button.destroy();
}
