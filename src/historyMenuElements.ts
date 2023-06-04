import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import St from 'gi://St';

// Legacy importing style for shell internal bindings not available in standard import format
// For correct typing use: 'InstanceType<typeof Adw.ActionRow>'
const PopupMenu = imports.ui.popupMenu;

import * as HistoryModule from './history.js';
import * as Settings from './settings.js';
import * as Utils from './utils.js';

import {AFTimer as Timer} from './timer.js';
import {Logger} from './logger.js';

// https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper
Gio._promisify(Gio.File.prototype, 'copy_async', 'copy_finish');
Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');

const HistoryElement = GObject.registerClass({
    GTypeName: 'HistoryElement',
}, class HistoryElement extends PopupMenu.PopupSubMenuMenuItem {
    private _logger = new Logger('RWG3', 'HistoryElement');
    private _settings = new Settings.Settings();

    private _prefixLabel;
    private _container;
    private _dateLabel;
    private _previewActor: Clutter.Actor | null = null;

    protected _setAsWallpaperItem;

    historyId: string;
    historyEntry: HistoryModule.HistoryEntry;

    /**
     * Create a new menu element for a HistoryEntry.
     *
     * @param {object | undefined} unusedParams Unused params object from the PopupMenu.PopupSubMenuMenuItem
     * @param {HistoryModule.HistoryEntry} historyEntry HistoryEntry this menu element serves
     * @param {number} index Place in history
     */
    constructor(unusedParams: object | undefined, historyEntry: HistoryModule.HistoryEntry, index: number) {
        super('', false);

        this.historyEntry = historyEntry;
        this.historyId = this.historyEntry.id; // extend the actor with the historyId

        const timestamp = this.historyEntry.timestamp;
        const date = new Date(timestamp);

        const timeString = date.toLocaleTimeString();
        const dateString = date.toLocaleDateString();

        const prefixText = `${String(index)}.`;
        this._prefixLabel = new St.Label({
            text: prefixText,
            style_class: 'rwg-history-index',
        });

        if (index === 0) {
            this.label.text = 'Current Background';
        } else {
            this.actor.insert_child_above(this._prefixLabel, this.label);
            this.label.destroy();
        }

        this._container = new St.BoxLayout({
            vertical: true,
        });

        this._dateLabel = new St.Label({
            text: dateString,
            style_class: 'rwg-history-date',
        });
        this._container.add_child(this._dateLabel);

        const timeLabel = new St.Label({
            text: timeString,
            style_class: 'rwg-history-time',
        });
        this._container.add_child(timeLabel);

        if (index !== 0)
            this.actor.insert_child_above(this._container, this._prefixLabel);

        this.menu.actor.add_style_class_name('rwg-history-element-content');

        if (this.historyEntry.source !== null) {
            if (this.historyEntry.source.author !== null &&
                this.historyEntry.source.authorUrl !== null) {
                const authorItem = new PopupMenu.PopupMenuItem(`Image By: ${this.historyEntry.source.author}`);
                authorItem.connect('activate', () => {
                    if (this.historyEntry.source.authorUrl) {
                        Utils.execCheck(['xdg-open', this.historyEntry.source.authorUrl]).catch(error => {
                            this._logger.error(error);
                        });
                    }
                });

                this.menu.addMenuItem(authorItem);
            }

            if (this.historyEntry.source.source !== null &&
                this.historyEntry.source.sourceUrl !== null) {
                const sourceItem = new PopupMenu.PopupMenuItem(`Image From: ${this.historyEntry.source.source}`);
                sourceItem.connect('activate', () => {
                    if (this.historyEntry.source.sourceUrl) {
                        Utils.execCheck(['xdg-open', this.historyEntry.source.sourceUrl]).catch(error => {
                            this._logger.error(error);
                        });
                    }
                });

                this.menu.addMenuItem(sourceItem);
            }

            const imageUrlItem = new PopupMenu.PopupMenuItem('Open Image In Browser');
            imageUrlItem.connect('activate', () => {
                if (this.historyEntry.source.imageLinkUrl) {
                    Utils.execCheck(['xdg-open', this.historyEntry.source.imageLinkUrl]).catch(error => {
                        this._logger.error(error);
                    });
                }
            });

            this.menu.addMenuItem(imageUrlItem);
        } else {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Unknown source.'));
        }

        const previewItem = new PopupMenu.PopupBaseMenuItem({can_focus: false, reactive: false});
        this.menu.addMenuItem(previewItem);

        this._setAsWallpaperItem = new PopupMenu.PopupMenuItem('Set As Wallpaper');
        this._setAsWallpaperItem.connect('activate', () => {
            this.emit('activate', null); // Fixme: not sure what the second parameter should be. null seems to work fine for now.
        });

        if (index !== 0) {
            // this.menu.addMenuItem(new PopupMenu.PopupBaseMenuItem({ can_focus: false, reactive: false })); // theme independent spacing
            this.menu.addMenuItem(this._setAsWallpaperItem);
        }

        const copyToFavorites = new PopupMenu.PopupMenuItem('Save For Later');
        copyToFavorites.connect('activate', () => {
            this._saveImage().catch(error => {
                this._logger.error(error);
            });
        });
        this.menu.addMenuItem(copyToFavorites);

        // Static URLs can't block images (yet?)
        if (this.historyEntry.adapter?.type !== Utils.SourceType.STATIC_URL) {
            const blockImage = new PopupMenu.PopupMenuItem('Add To Blocklist');
            blockImage.connect('activate', () => {
                this._addToBlocklist();
            });
            this.menu.addMenuItem(blockImage);
        }

        /*
            Load the image on first opening of the sub menu instead of during creation of the history list.
         */
        this.menu.connect('open-state-changed', (_, open: boolean | unknown) => {
            if (open) {
                if (this._previewActor !== null)
                    return;

                if (!this.historyEntry.path) {
                    this._logger.error('Image path in entry not found');
                    return;
                }

                try {
                    const width = 270; // 270 looks good for the now fixed 350px menu width
                    // const width = this.menu.actor.get_width(); // This should be correct but gives different results per element?
                    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(this.historyEntry.path, width, -1, true);
                    const height = pixbuf.get_height();

                    const image = new Clutter.Image();
                    const pixelFormat = pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888;
                    image.set_data(
                        pixbuf.get_pixels(),
                        pixelFormat,
                        width,
                        height,
                        pixbuf.get_rowstride()
                    );
                    this._previewActor = new Clutter.Actor({height, width});
                    this._previewActor.set_content(image);

                    previewItem.actor.add_actor(this._previewActor);
                } catch (exception) {
                    this._logger.error(String(exception));
                }
            }
        });
    }

    /**
     * Add an image to the blocking list.
     *
     * Uses the filename for distinction.
     */
    private _addToBlocklist(): void {
        if (!this.historyEntry.adapter?.id || this.historyEntry.adapter.id === '-1' || !this.historyEntry.name) {
            this._logger.error('Image entry is missing information');
            return;
        }

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${this.historyEntry.adapter.id}/`;
        const generalSettings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);
        const blockedFilenames = generalSettings.getStrv('blocked-images');

        if (blockedFilenames.includes(this.historyEntry.name))
            return;

        blockedFilenames.push(this.historyEntry.name);
        generalSettings.setStrv('blocked-images', blockedFilenames);
    }

    /**
     * Save the image to the favorites folder.
     */
    private async _saveImage(): Promise<void> {
        if (!this.historyEntry.path || !this.historyEntry.name)
            throw new Error('Image entry is missing information');

        const sourceFile = Gio.File.new_for_path(this.historyEntry.path);
        const targetFolder = Gio.File.new_for_path(this._settings.getString('favorites-folder'));
        const targetFile = targetFolder.get_child(this.historyEntry.name);
        const targetInfoFile = targetFolder.get_child(`${this.historyEntry.name}.json`);

        try {
            if (!targetFolder.make_directory_with_parents(null))
                throw new Error('Could not create directories.');
        } catch (error) {
            if (error instanceof GLib.Error && error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) // noop
                this._logger.debug('Folder already exists.');
            else // escalate
                throw error;
        }

        // This function was rewritten by Gio._promisify
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/await-thenable
        if (!await sourceFile.copy_async(targetFile, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, null, null))
            throw new Error('Failed copying image.');

        // https://gjs.guide/guides/gio/file-operations.html#writing-file-contents
        // This function was rewritten by Gio._promisify
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/await-thenable
        const [success, message]: [boolean, string] = await targetInfoFile.replace_contents_bytes_async(
            new TextEncoder().encode(JSON.stringify(this.historyEntry.source, null, '\t')),
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null);

        if (!success)
            throw new Error(`Failed writing file contents: ${message}`);
    }

    /**
     * Prefix the menu label with a number.
     *
     * @param {number} index Number to prefix
     */
    setIndex(index: number): void {
        this._prefixLabel.set_text(`${String(index)}.`);
    }
});

const CurrentImageElement = GObject.registerClass({
    GTypeName: 'CurrentImageElement',
}, class CurrentImageElement extends HistoryElement {
    /**
     * Create a new image element for the currently active wallpaper.
     *
     * @param {object | undefined} params Option object of PopupMenu.PopupSubMenuMenuItem
     * @param {HistoryModule.HistoryEntry} historyEntry History entry this menu is for
     */
    constructor(params: object | undefined, historyEntry: HistoryModule.HistoryEntry) {
        super(params, historyEntry, 0);

        if (this._setAsWallpaperItem)
            this._setAsWallpaperItem.destroy();
    }
});

/**
 * Element for the "New Wallpaper" button and the remaining time for the auto fetch
 * feature.
 * The remaining time will only be displayed if the af-feature is activated.
 */
const NewWallpaperElement = GObject.registerClass({
    GTypeName: 'NewWallpaperElement',
},
class NewWallpaperElement extends PopupMenu.PopupBaseMenuItem {
    private _timer = Timer.getTimer();
    private _remainingLabel;

    /**
     * Create a button for fetching new wallpaper
     *
     * @param {object | undefined} params Options object of PopupMenu.PopupBaseMenuItem
     */
    constructor(params: object | undefined) {
        super(params);

        const container = new St.BoxLayout({
            vertical: true,
        });

        const newWPLabel = new St.Label({
            text: 'New Wallpaper',
            style_class: 'rwg-new-label',
        });
        container.add_child(newWPLabel);

        this._remainingLabel = new St.Label({
            text: '1 minute remaining',
        });
        container.add_child(this._remainingLabel);

        this.actor.add_child(container);
    }

    /**
     * Checks the AF-setting and shows/hides the remaining minutes section.
     */
    show(): void {
        if (this._timer.isActive()) {
            const remainingMinutes = this._timer.remainingMinutes();
            const minutes = remainingMinutes % 60;
            const hours = Math.floor(remainingMinutes / 60);

            let hoursText = hours.toString();
            hoursText += hours === 1 ? ' hour' : ' hours';
            let minText = minutes.toString();
            minText += minutes === 1 ? ' minute' : ' minutes';

            if (hours >= 1)
                this._remainingLabel.text = `... ${hoursText} and ${minText} remaining.`;
            else
                this._remainingLabel.text = `... ${minText} remaining.`;


            this._remainingLabel.show();
        } else {
            this._remainingLabel.hide();
        }
    }
});

/**
 * The status element in the Gnome Shell top panel bar.
 */
class StatusElement {
    icon;

    /**
     * Create a new menu status element.
     */
    constructor() {
        this.icon = new St.Icon({
            icon_name: 'preferences-desktop-wallpaper-symbolic',
            style_class: 'system-status-icon',
        });
    }

    /**
     * Pulsate the icon opacity as a loading animation.
     */
    startLoading(): void {
        // FIXME: Don't know where this is defined
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.icon.ease({
            opacity: 20,
            duration: 1337,
            mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
            autoReverse: true,
            repeatCount: -1,
        });
    }

    /**
     * Stop pulsating the icon opacity.
     */
    stopLoading(): void {
        this.icon.remove_all_transitions();
        this.icon.opacity = 255;
    }
}

/**
 * The history section holding multiple history elements.
 */
class HistorySection extends PopupMenu.PopupMenuSection {
    /**
     * Cache HistoryElements for performance of long histories.
     */
    private _historySectionCache = new Map<string, InstanceType<typeof HistoryElement>>();
    private _historyCache: HistoryModule.HistoryEntry[] = [];

    /**
     * Create a new history section.
     */
    constructor() {
        super();

        this.actor = new St.ScrollView({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        });

        this.actor.add_actor(this.box);
    }

    /**
     * Clear and rebuild the history element list using cached elements where possible.
     *
     * @param {HistoryModule.HistoryEntry[]} history History list to rebuild from.
     * @param {(HistoryElement) => void} onEnter Function to call on menu element key-focus-in
     * @param {(HistoryElement) => void} onLeave Function to call on menu element key-focus-out
     * @param {(HistoryElement) => void} onSelect Function to call on menu element enter-event
     */
    updateList(
        history: HistoryModule.HistoryEntry[],
        onEnter: (actor: InstanceType<typeof HistoryElement>) => void,
        onLeave: (actor: InstanceType<typeof HistoryElement>) => void,
        onSelect: (actor: InstanceType<typeof HistoryElement>) => void
    ): void {
        if (this._historyCache.length <= 1)
            this.removeAll(); // remove empty history element

        const existingHistoryElements = [];

        for (let i = 1; i < history.length; i++) {
            const historyID = history[i].id;

            if (!historyID)
                continue;

            let cachedHistoryElement = this._historySectionCache.get(historyID);
            if (!cachedHistoryElement) {
                cachedHistoryElement = new HistoryElement(undefined, history[i], i);
                cachedHistoryElement.actor.connect('key-focus-in', onEnter);
                cachedHistoryElement.actor.connect('key-focus-out', onLeave);
                cachedHistoryElement.actor.connect('enter-event', onEnter);

                cachedHistoryElement.connect('activate', onSelect);
                this._historySectionCache.set(historyID, cachedHistoryElement);

                this.addMenuItem(cachedHistoryElement, i - 1);
            } else {
                cachedHistoryElement.setIndex(i);
            }

            existingHistoryElements.push(historyID);
        }

        this._cleanupHistoryCache(existingHistoryElements);
        this._historyCache = history;
    }

    /**
     * Cleanup the cache for entries not in $existingIDs.
     *
     * @param {string[]} existingIDs List with IDs that exists in the history
     */
    private _cleanupHistoryCache(existingIDs: string[]): void {
        const destroyIDs = Array.from(this._historySectionCache.keys()).filter(i => existingIDs.indexOf(i) === -1);

        destroyIDs.forEach(id => {
            this._historySectionCache.get(id)?.destroy();
            this._historySectionCache.delete(id);
        });
    }

    /**
     * Clear and remove all history elements.
     */
    clear(): void {
        this._cleanupHistoryCache([]);
        this.removeAll();
        this.addMenuItem(
            new PopupMenu.PopupMenuItem('No recent wallpaper ...', {
                activate: false,
                hover: false,
                style_class: 'rwg-recent-label',
                can_focus: false,
            })
        );

        this._historyCache = [];
    }
}

export {
    StatusElement,
    NewWallpaperElement,
    HistorySection,
    CurrentImageElement,
    HistoryElement
};
