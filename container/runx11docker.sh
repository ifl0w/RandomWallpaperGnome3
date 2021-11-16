#!/bin/sh

SCRIPT_DIR=$(dirname $(readlink -f $0))
SRC_DIR=$SCRIPT_DIR/../randomwallpaper@iflow.space
DST_DIR=/home/dev/.local/share/gnome-shell/extensions/randomwallpaper@iflow.space

if [ -z "$1" ]
  then
    echo "$(basename $0): Provide your docker image as an argument"
    exit 22
fi

echo "$(basename $0): You might have to move the X window around before GNOME is fully loaded"
sleep 3

$SCRIPT_DIR/x11docker/x11docker \
	--desktop \
	--init=systemd \
	--user=RETAIN \
	-- --mount type=bind,source=$SRC_DIR,target=$DST_DIR,readonly -- \
	$1
