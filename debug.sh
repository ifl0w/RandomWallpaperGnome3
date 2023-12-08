#!/bin/bash

if [ "$1" = "prefs" ]; then
  journalctl -f /usr/bin/gjs
elif [ "$1" = "filtered" ]; then
  # Note: filtering journal via the extensions UUID was removed in 45.
  # Falling back to grep log filtering. This is only necessary when other
  # extensions produce to much output in the gnome-shell log.
  # https://gjs.guide/extensions/upgrading/gnome-shell-45.html#logging
  journalctl -f /usr/bin/gnome-shell | grep "RandomWallpaper"
else
  journalctl -f /usr/bin/gnome-shell
fi
