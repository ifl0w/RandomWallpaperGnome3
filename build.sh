#!/bin/bash

BASEDIR="randomwallpaper@iflow.space"
ZIPNAME="$BASEDIR.zip"

rm "$ZIPNAME"
rm "$BASEDIR/schemas/gschemas.compiled"
rm "$BASEDIR/wallpapers/"*
glib-compile-schemas "$BASEDIR/schemas/"

# cd "$BASEDIR/ui" || exit 1
blueprint-compiler batch-compile "$BASEDIR/ui" "$BASEDIR/ui" \
    "$BASEDIR/ui/generic_json.blp" \
    "$BASEDIR/ui/page_general.blp" \
    "$BASEDIR/ui/page_sources.blp" \
    "$BASEDIR/ui/reddit.blp" \
    "$BASEDIR/ui/source_row.blp" \
    "$BASEDIR/ui/unsplash.blp" \
    "$BASEDIR/ui/wallhaven.blp"

cd "$BASEDIR" || exit 1
zip -r "$ZIPNAME" .
mv "$ZIPNAME" ..
