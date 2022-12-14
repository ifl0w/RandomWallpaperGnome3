#!/bin/bash

if [ "$1" = "prefs" ]; then
  journalctl -f /usr/bin/gjs
else
  # https://gjs.guide/extensions/development/debugging.html#logging
  journalctl -f GNOME_SHELL_EXTENSION_UUID=randomwallpaper@iflow.space
fi
