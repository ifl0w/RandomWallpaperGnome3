RandomWallpaperGnome3
=====================

Random Wallpapers for Gnome 3 is a gnome-shell extension that fetches a random wallpaper from an online source and sets it as desktop background.

Install and try the extension at [extensions.gnome.org](https://extensions.gnome.org/extension/1040/random-wallpaper/).

![Screenshot](/assets/screenshot.png)

## Features

* Many different online sources with filters
    * Unsplash (https://unsplash.com/)
    * Wallhaven (https://alpha.wallhaven.cc/)
    * Reddit (https://reddit.com)
    * Basically any JSON API/File ([Examples](https://github.com/ifl0w/RandomWallpaperGnome3/wiki/Generic-JSON-Source))
      * Chromecast Images
      * NASA Picture of the day
      * Bing Picture of the day
      * Google Earth View
* History of previous images
* Set lock screen image
* Automatic renewal (Auto-Fetching)

## Installation (symlink to the repository)
Requires [`blueprint-compiler`](https://repology.org/project/blueprint-compiler/versions) at install and update time.

Clone the repository and run `./build.sh && ./install.sh` in the repository folder to make a symbolic link from the extensions folder to the git repository.
This installation will depend on the repository folder, so do not delete the cloned folder.

Then open the command prompt (Alt+F2) end enter `r` to restart the gnome session.
In the case you are using Wayland, then no restart should be required.

Now you should be able to activate the extension through the gnome-tweak-tool.

__Installing this way has various advantages:__
* Switching between versions and branches.
* Updating the extension with `git pull && ./build.sh`

## Installation (manually)
Requires [`blueprint-compiler`](https://repology.org/project/blueprint-compiler/versions) at install and update time.

Clone or download the repository and copy the folder `randomwallpaper@iflow.space` in the repository to `~/.local/share/gnome-shell/extensions/`.
Run `./build.sh` inside the repository.

Then open the command prompt (Alt+F2) end enter `r` to restart the gnome session.
In the case you are using Wayland, then no restart should be required.

Now you should be able to activate the extension through the gnome-tweak-tool.

## Uninstall
Run `./install uninstall` to delete the symbolic link.
If you installed the extension manually you have to delete the extension folder `randomwallpaper@iflow.space` in `~/.local/share/gnome-shell/extensions/`.

## Debugging
You can follow the output of the extension with `./debug.sh`. Information should be printed using the existing logger class but can also be printed with `global.log()` (not recommended).
To debug the `prefs.js` use `./debug.sh prefs`.

## Compiling schemas
This can be done with the command: `glib-compile-schemas randomwallpaper@iflow.space/schemas/`

## Compiling UI
Requires [`blueprint-compiler`](https://jwestman.pages.gitlab.gnome.org/blueprint-compiler/).
Run `./build.sh` to compile ui files.

## Adding predefined sources
1. Build UI for settings using the [blueprint-compiler](https://jwestman.pages.gitlab.gnome.org/blueprint-compiler/) language in `…/ui/mySource.blp` - see [Workbench](https://apps.gnome.org/app/re.sonny.Workbench/) for a live preview editor.
    * Add the file to `build.sh`
1. Create a settings layout to the `…/schemas/….gschema.xml`
1. Create your logic hooking the settings in a `…/ui/mySource.js`
1. Add the new source to `…/ui/sourceRow.js`
1. Create a adapter to read the settings and fetching the images and additional information in `…/adapter/mySource.js` by extending the `BaseAdapter`.
    * Add your adapter to `…/wallpaperController.js`

## Support Me
If you enjoy this extension and want to support the development, then feel free to buy me a coffee. :wink: :coffee:


[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RBLX73X4DPS7A)
