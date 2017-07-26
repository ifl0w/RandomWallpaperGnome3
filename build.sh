#!/bin/bash

BASEDIR="randomwallpaper@iflow.space"
ZIPNAME="$BASEDIR.zip"

rm $ZIPNAME
rm $BASEDIR/schemas/gschemas.compiled
rm $BASEDIR/wallpapers/*
glib-compile-schemas $BASEDIR/schemas/

cd $BASEDIR
zip -r $ZIPNAME .
mv $ZIPNAME ..