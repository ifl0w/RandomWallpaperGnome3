RandomWallpaperGnome3
=====================

Random Wallpapers for Gnome 3 is a gnome shell extension which fetches a random wallpaper from an online source and sets it as desktop background.

## Installation

Open the commandline and type the following lines:

```
git clone git@github.com:ifl0w/RandomWallpaperGnome3.git
cd ~/.local/share/gnome-shell/extensions/
ln -s /path/to/source/randomwallpaper@iflow.productions .
```

Then open the command prompt (Alt+F2) end enter `r` without qotes.
Now you should be able to activate the extension through the gnome-tweak-tool.

## Debuging
Debuging can be started via `sh debug.sh`. Information can be printed with `global.log()`.
To debug the prefs.js use `sh debug.sh perfs`. In this case you should print debug messages with `print()`.

## Compiling schemas
This can be done with the command: `glib-compile-schemas schemas/`
