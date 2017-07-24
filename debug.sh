#!/bin/bash

if [ "$1" = "prefs" ]; then
  gnome-shell-extension-prefs randomwallpaper@iflow.space
else
  journalctl -f /usr/bin/gnome-shell
fi
