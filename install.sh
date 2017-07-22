#!/bin/bash

extensionFolder="randomwallpaper@iflow.space"
sourcepath="$PWD/$extensionFolder"
targetpath="/home/$USER/.local/share/gnome-shell/extensions"

if [[ $1 == 'uninstall' ]]; then
	echo "# Removing $targetpath/$extensionFolder"
	rm "$targetpath/$extensionFolder"
else
	echo "# Making extension directory"
	mkdir -p $targetpath
	echo "# Linking extension folder"
	ln -s $sourcepath "$targetpath/$extensionFolder"
fi
