#!/usr/bin/env bash

UUID="randomwallpaper@iflow.space"

# fail on error
set -e

# https://unix.stackexchange.com/a/20325
if [[ $EUID -eq 0 ]]; then
    echo "This script must NOT be run as root" 1>&2
    exit 1
fi

# https://stackoverflow.com/a/246128
SCRIPTDIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)

SRCDIR="$SCRIPTDIR/src"
DESTDIR="$SCRIPTDIR/$UUID"

cd "$SCRIPTDIR" || exit 1

check_command() {
    if ! command -v "$1" &>/dev/null; then
        echo "Please install \"$1\" and make sure it's available in your \$PATH"
        exit 1
    fi
}

setup_environment() {
    check_command "npm"

    # install, config in package.json
    npm --silent install

    # Delete output directory, everything will be rewritten
    rm -r "$DESTDIR" &>/dev/null || true
}

compile_ui() {
    check_command "blueprint-compiler"

    # Compile UI files
    blueprint-compiler batch-compile "$DESTDIR/ui" "$SRCDIR/ui" "$SRCDIR"/ui/*.blp
}

compile_js() {
    check_command "npm"

    # TypeScript to JavaScript, config in tsconfig.json
    npx --silent tsc

    # rewrite shell imports to gjs legacy module system
    shopt -s globstar nullglob
    for file in "$DESTDIR"/**/*.js; do
        # Special module naming
        sed -i -E "s#import \* as ByteArray from '@gi-types/gjs-environment/legacyModules/byteArray';#const ByteArray = imports.byteArray;#g" "$file"

        # Special cases for extension internal imports, shell
        sed -i -E "s#import \* as ExtensionUtils from '@gi/misc/extensionUtils';#const ExtensionUtils = imports.misc.extensionUtils;#g" "$file"
        sed -i -E "s#import \* as PopupMenu from '@gi/ui/popupMenu';#const PopupMenu = imports.ui.popupMenu;#g" "$file"
        sed -i -E "s#import \* as PanelMenu from '@gi/ui/panelMenu';#const PanelMenu = imports.ui.panelMenu;#g" "$file"
        sed -i -E "s#import \* as Main from '@gi/ui/main';#const Main = imports.ui.main;#g" "$file"
    done

    # extension.js and prefs.js can't be modules (yet) while dynamically loaded by GJS…
    # https://gjs.guide/extensions/overview/imports-and-modules.html#imports-and-modules
    # …and TypeScript can't compile specific files to "not a module" in overall module mode.
    # https://github.com/microsoft/TypeScript/issues/41567
    sed -i -E "s#export \{\};##g" "$DESTDIR/extension.js"

    # Work around standard imports not available in files loaded by the shell, those can't be modules (yet)
    # > Note that as of GNOME 44, neither GNOME Shell nor Extensions support ESModules, and must use GJS's custom import scheme.
    # https://gjs.guide/extensions/overview/imports-and-modules.html#imports-and-modules
    # https://gjs-docs.gnome.org/gjs/esmodules.md
    # > JS ERROR: Extension randomwallpaper@iflow.space: SyntaxError: import declarations may only appear at top level of a module
    sed -i -E "s#import (.*) from 'gi://.*';#const \1 = imports.gi.\1;#g" "$DESTDIR/extension.js"
    sed -i -E "s#import (.*) from 'gi://.*';#const \1 = imports.gi.\1;#g" "$DESTDIR/prefs.js"
}

# TODO: Drop compiled schemas when only targeting Gnome 44+
# https://gjs.guide/extensions/upgrading/gnome-shell-44.html#gsettings-schema
compile_schemas() {
    check_command "glib-compile-schemas"
    mkdir -p "$DESTDIR/schemas/"

    # the pack command also compiles the schemas but only into the zip file
    glib-compile-schemas --targetdir="$DESTDIR/schemas" "$SRCDIR/schemas/"
}

format_js() {
    check_command "npm"

    # Circumvent not found typescript rules that might be mentioned in code comments but will give an error
    # when only checking with javascript rules
    # https://stackoverflow.com/questions/64614131/how-can-i-disable-definition-for-rule-custom-rule-was-not-found-errors
    shopt -s globstar nullglob
    for file in "$DESTDIR"/**/*.js; do
        sed -i -E "s#@typescript-eslint/await-thenable##g" "$file"
        sed -i -E "s#@typescript-eslint/no-unused-vars##g" "$file"
        sed -i -E "s#@typescript-eslint/no-unsafe-argument##g" "$file"
        sed -i -E "s#@typescript-eslint/no-unsafe-member-access##g" "$file"
        sed -i -E "s#@typescript-eslint/no-unsafe-call##g" "$file"
    done

    # Format js using the official gjs stylesheet and a few manual quirks
    npx --silent eslint --no-eslintrc --config "$SCRIPTDIR/.eslintrc-gjs.yml" --fix "$DESTDIR/**/*.js"
}

check_ts() {
    check_command "npm"

    npx --silent eslint "$SRCDIR/**/*.ts"
}

copy_static_files() {
    # Copy non generated files to destdir
    mkdir -p "$DESTDIR/schemas/"
    cp "$SRCDIR/schemas/org.gnome.shell.extensions.space.iflow.randomwallpaper.gschema.xml" "$DESTDIR/schemas/"
    cp "$SRCDIR/metadata.json" "$DESTDIR/"
    cp "$SRCDIR/stylesheet.css" "$DESTDIR/"
}

pack() {
    check_command "gnome-extensions"

    # pack everything into a sharable zip file
    extra_source=()
    for file in "$DESTDIR"/*; do
        extra_source+=("--extra-source=$file")
    done

    gnome-extensions pack --force "${extra_source[@]}" "$DESTDIR"
}

if [ $# -eq 0 ]; then
    # No arguments, do everything
    setup_environment
    compile_ui
    compile_js
    compile_schemas
    format_js
    check_ts
    copy_static_files
    pack
elif [ "$1" == "check" ]; then
    check_ts
elif [ "$1" == "build" ]; then
    compile_ui
    compile_js
    compile_schemas
elif [ "$1" == "format" ]; then
    format_js
elif [ "$1" == "pack" ]; then
    copy_static_files
    pack
elif [ "$1" == "setup_env" ]; then
    setup_environment
elif [ "$1" == "copy_static" ]; then
    copy_static_files
fi
