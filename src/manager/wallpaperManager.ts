import {Settings} from './../settings.js';

// Generated code produces a no-shadow rule error
/* eslint-disable */
enum Mode {
    /** Only change the desktop background */
    BACKGROUND,
    /** Only change the lock screen background */
    LOCKSCREEN,
    /** Change the desktop and lock screen background to the same image. */
    // This allows for optimizations when processing images.
    BACKGROUND_AND_LOCKSCREEN,
    /** Change each - the desktop and lock screen background - to different images. */
    BACKGROUND_AND_LOCKSCREEN_INDEPENDENT,
}

enum ZoomMode {
    /** No wallpaper. Literally. */
    // Deactivated because this doesn't make sense
    // NONE,
    /** Mosaic style, probably for tiling images. */
    WALLPAPER,
    /** Centered image, no scaling. */
    CENTERED,
    /** Scales to fit, with black borders. */
    SCALED,
    /** Stretches the image to fit, without considering aspect ratio. */
    STRETCHED,
    /** Scales to fit, without black borders. */
    ZOOM,
    /**
     * Stretches one image across a whole (multi-monitor) canvas, without considering aspect ratio.
     * Crafting a correctly sized image allows for multiple images on different displays.
    */
    SPANNED,
}
/* eslint-enable */

/**
 * Wallpaper manager is a base class for manager to implement.
 */
abstract class WallpaperManager {
    public canHandleMultipleImages = false;

    protected _backgroundSettings = new Settings('org.gnome.desktop.background');
    protected _screensaverSettings = new Settings('org.gnome.desktop.screensaver');

    /**
     * Set the wallpapers for a given mode.
     *
     * @param {string[]} wallpaperPaths Array of paths to the desired wallpapers, should match the display count
     * @param {Mode} mode Enum indicating what images to change
     */
    async setWallpaper(wallpaperPaths: string[], mode: Mode = Mode.BACKGROUND): Promise<void> {
        if (wallpaperPaths.length < 1)
            throw new Error('Empty wallpaper array');

        const promises = [];
        if (mode === Mode.BACKGROUND || mode === Mode.BACKGROUND_AND_LOCKSCREEN)
            promises.push(this._setBackground(wallpaperPaths));

        if (mode === Mode.LOCKSCREEN || mode === Mode.BACKGROUND_AND_LOCKSCREEN)
            promises.push(this._setLockScreen(wallpaperPaths));

        if (mode === Mode.BACKGROUND_AND_LOCKSCREEN_INDEPENDENT) {
            if (wallpaperPaths.length < 2)
                throw new Error('Not enough wallpaper');

            // Half the images for the background
            promises.push(this._setBackground(wallpaperPaths.slice(0, wallpaperPaths.length / 2)));
            // Half the images for the lock screen
            promises.push(this._setLockScreen(wallpaperPaths.slice(wallpaperPaths.length / 2)));
        }

        await Promise.allSettled(promises);
    }

    protected abstract _setBackground(wallpaperPaths: string[]): Promise<void>;
    protected abstract _setLockScreen(wallpaperPaths: string[]): Promise<void>;
}

/**
 * Retrieve the human readable enum name.
 *
 * @param {Mode} mode The mode to name
 * @returns {string} Name
 */
function _getModeName(mode: Mode): string {
    let name: string;

    switch (mode) {
    case Mode.BACKGROUND:
        name = 'Background';
        break;
    case Mode.LOCKSCREEN:
        name = 'Lockscreen';
        break;
    case Mode.BACKGROUND_AND_LOCKSCREEN:
        name = 'Background and lockscreen';
        break;
    case Mode.BACKGROUND_AND_LOCKSCREEN_INDEPENDENT:
        name = 'Background and lockscreen independently';
        break;

    default:
        name = 'Mode name not found';
        break;
    }

    return name;
}

/**
 * Get a list of human readable enum entries.
 *
 * @returns {string[]} Array with key names
 */
function getModeNameList(): string[] {
    const list: string[] = [];

    const values = Object.values(Mode).filter(v => !isNaN(Number(v)));
    for (const i of values)
        list.push(_getModeName(i as Mode));

    return list;
}

/**
 * Retrieve the human readable enum name.
 *
 * @param {ZoomMode} mode The zoom mode to name
 * @returns {string} Name
 */
function getZoomName(mode: ZoomMode): string {
    let name: string;

    switch (mode) {
    // case ZoomMode.NONE:
    //     name = 'none';
    //     break;
    case ZoomMode.WALLPAPER:
        name = 'wallpaper';
        break;
    case ZoomMode.CENTERED:
        name = 'centered';
        break;
    case ZoomMode.SCALED:
        name = 'scaled';
        break;
    case ZoomMode.STRETCHED:
        name = 'stretched';
        break;
    case ZoomMode.ZOOM:
        name = 'zoom';
        break;
    case ZoomMode.SPANNED:
        name = 'spanned';
        break;

    default:
        name = 'Mode name not found';
        break;
    }

    return name;
}

/**
 * Get a list of human readable enum entries.
 *
 * @returns {string[]} Array with key names
 */
function getZoomModeNameList(): string[] {
    const list: string[] = [];

    const values = Object.values(ZoomMode).filter(v => !isNaN(Number(v)));
    for (const i of values)
        list.push(getZoomName(i as ZoomMode));

    return list;
}

export {
    WallpaperManager,
    Mode,
    getModeNameList,
    getZoomModeNameList,
    getZoomName
};
