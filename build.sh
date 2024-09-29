#!/usr/bin/env bash

UUID="randomwallpaper@iflow.space"

# fail on error
set -e
# log executed commands
set -x

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
    npm install

    # Delete output directory, everything will be rewritten
    rm -r "${DESTDIR:?}" &>/dev/null || true
}

compile_ui() {
    check_command "blueprint-compiler"

    # Compile UI files
    blueprint-compiler batch-compile "$DESTDIR/ui" "$SRCDIR/ui" "$SRCDIR"/ui/*.blp
}

compile_js() {
    check_command "npm"

    # TypeScript to JavaScript, config in tsconfig.json
    npx tsc
}

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
        sed -i -E "s#@typescript-eslint/ban-ts-comment##g" "$file"
        sed -i -E "s#@typescript-eslint/no-unsafe-enum-comparison##g" "$file"
    done

    # Format js using the official gjs stylesheet and a few manual quirks
    npx eslint --no-eslintrc --config "$SCRIPTDIR/.eslintrc-gjs.yml" --fix "$DESTDIR/**/*.js"
}

check_ts() {
    check_command "npm"

    npx eslint "$SRCDIR/**/*.ts"
}

copy_static_files() {
    # Copy non generated files to destdir
    mkdir -p "$DESTDIR/schemas/"
    cp "$SRCDIR/schemas/org.gnome.shell.extensions.space.iflow.randomwallpaper.gschema.xml" "$DESTDIR/schemas/"
    cp "$SRCDIR/metadata.json" "$DESTDIR/"
    cp "$SRCDIR/stylesheet.css" "$DESTDIR/"
}

update_translation_template() {
    # get relative paths so comments in pot do not depend on local folder structure
    RELATIVE_SRC_DIR=$(realpath --relative-to="$PWD" "$SRCDIR/po/org.gnome.shell.extensions.space.iflow.randomwallpaper.pot")
    RELATIVE_DST_DIR=$(realpath --relative-to="$PWD" "$DESTDIR")

    # generate template
    xgettext --from-code=UTF-8 --from-code=UTF-8 --add-comments --keyword=_ --keyword=C_:1c,2 --output=./$RELATIVE_SRC_DIR ./$RELATIVE_DST_DIR/**/*.js ./$RELATIVE_DST_DIR/**/*.ui
}

pack() {
    check_command "gnome-extensions"

    # pack everything into a sharable zip file
    extra_source=()
    for file in "$DESTDIR"/*; do
        extra_source+=("--extra-source=$file")
    done

    gnome-extensions pack --force "${extra_source[@]}" --podir=$SRCDIR/po "$DESTDIR"

    # unpack again over generated files to populate locale directory
    unzip -ou -d $DESTDIR $DESTDIR".shell-extension.zip"
}

if [ $# -eq 0 ]; then
    # No arguments, do everything
    setup_environment
    compile_ui
    compile_js
    compile_schemas
    format_js
    check_ts
    update_translation_template
    copy_static_files
    pack
elif [ "$1" == "check" ]; then
    check_ts
elif [ "$1" == "build" ]; then
    compile_ui
    compile_js
elif [ "$1" == "build_local" ]; then
    compile_ui
    compile_js
    compile_schemas
    update_translation_template
    copy_static_files
elif [ "$1" == "dev" ]; then
    compile_ui
    compile_js
    compile_schemas
    update_translation_template
    copy_static_files
    pack
elif [ "$1" == "format" ]; then
    format_js
elif [ "$1" == "pack" ]; then
    pack
elif [ "$1" == "setup_env" ]; then
    setup_environment
elif [ "$1" == "copy_static" ]; then
    copy_static_files
elif [ "$1" == "update_translation" ]; then
    update_translation_template
fi
