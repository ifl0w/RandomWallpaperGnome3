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
Requires [`blueprint-compiler`](https://repology.org/project/blueprint-compiler/versions) and [`npm`](https://repology.org/project/npm/versions) at install and update time.

Clone the repository and run `./build.sh && ./install.sh` in the repository folder to make a symbolic link from the extensions folder to the git repository.
This installation will depend on the repository folder, so do not delete the cloned folder.

Then open the command prompt (Alt+F2) end enter `r` to restart the gnome session.
In the case you are using Wayland, then no restart should be required.

Now you should be able to activate the extension through the gnome-tweak-tool.

__Installing this way has various advantages:__
* Switching between versions and branches.
* Updating the extension with `git pull && ./build.sh`

## Installation (manually)
Requires [`blueprint-compiler`](https://repology.org/project/blueprint-compiler/versions) and [`npm`](https://repology.org/project/npm/versions) at install and update time.

Clone or download the repository and copy the folder `randomwallpaper@iflow.space` in the repository to `$XDG_DATA_HOME/gnome-shell/extensions/` (usually `$HOME/.local/share/gnome-shell/extensions/`).
Run `./build.sh` inside the repository.

Then open the command prompt (Alt+F2) end enter `r` to restart the gnome session.
In the case you are using Wayland, then no restart should be required.

Now you should be able to activate the extension through the gnome-tweak-tool.

## Uninstall
Run `./install uninstall` to delete the symbolic link.
If you installed the extension manually you have to delete the extension folder `randomwallpaper@iflow.space` in `$XDG_DATA_HOME/gnome-shell/extensions/` (usually `$HOME/.local/share/gnome-shell/extensions/`).

## Debugging
You can follow the output of the extension with `./debug.sh`. Information should be printed using the existing logger class but can also be printed with `global.log()` (not recommended).
To debug the `prefs.js` use `./debug.sh prefs`.

## Compiling individual parts
### Schemas
This can be done with the command:
~~~
glib-compile-schemas --targetdir="randomwallpaper@iflow.space/schemas/" "src/schemas"
~~~

### UI
Requires [`blueprint-compiler`](https://jwestman.pages.gitlab.gnome.org/blueprint-compiler/):
~~~
blueprint-compiler batch-compile "src/ui" "randomwallpaper@iflow.space/ui" "src"/ui/*.blp
~~~

### TypeScript
Requires [`npm`](https://repology.org/project/npm/versions):
~~~
npm install
npx --silent tsc
~~~

## Adding new sources
1. Build UI for settings using the [blueprint-compiler](https://jwestman.pages.gitlab.gnome.org/blueprint-compiler/) language in `src/ui/mySource.blp` - see [Workbench](https://apps.gnome.org/app/re.sonny.Workbench/) for a live preview editor.
1. Create and add a settings layout to the `src/schemas/….gschema.xml`. Also add your source to the `types` enum.
1. Create your logic hooking the settings in a `src/ui/mySource.ts`
1. Add the new source to `src/ui/sourceRow.ts:_getSettingsGroup()`, don't forget the import statement.
1. Create a adapter to read the settings and fetching the images and additional information in `src/adapter/mySource.ts` by extending the `BaseAdapter`.
1.  Add your adapter to `src/wallpaperController.ts:_getRandomAdapter()`, don't forget the import statement.

## Support Me
If you enjoy this extension and want to support the development, then feel free to buy me a coffee. :wink: :coffee:


[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RBLX73X4DPS7A)
