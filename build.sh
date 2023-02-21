#!/bin/bash

BASEDIR="randomwallpaper@iflow.space"
ZIPNAME="$BASEDIR.zip"

rm "$ZIPNAME"
rm "$BASEDIR/schemas/gschemas.compiled"
rm "$BASEDIR/wallpapers/"*
glib-compile-schemas "$BASEDIR/schemas/"

# cd "$BASEDIR/ui" || exit 1
blueprint-compiler batch-compile "$BASEDIR/ui" "$BASEDIR/ui" \
    "$BASEDIR/ui/genericJson.blp" \
    "$BASEDIR/ui/localFolder.blp" \
    "$BASEDIR/ui/pageGeneral.blp" \
    "$BASEDIR/ui/pageSources.blp" \
    "$BASEDIR/ui/reddit.blp" \
    "$BASEDIR/ui/sourceRow.blp" \
    "$BASEDIR/ui/unsplash.blp" \
    "$BASEDIR/ui/wallhaven.blp"

cd "$BASEDIR" || exit 1
zip -r "$ZIPNAME" .
mv "$ZIPNAME" ..
