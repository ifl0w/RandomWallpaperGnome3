#!/bin/bash

if [ "$1" = "prefs" ]; then
  journalctl -f /usr/bin/gjs
else
  journalctl -f /usr/bin/gnome-shell
fi
