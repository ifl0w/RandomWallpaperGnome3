import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as HistoryModule from './history.js';
import * as Settings from './settings.js';
import * as Utils from './utils.js';

import {AFTimer as Timer} from './timer.js';
import {Logger} from './logger.js';

// https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper
Gio._promisify(Gio.File.prototype, 'copy_async', 'copy_finish');
Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');

// FIXME: Generated static class code produces a no-unused-expressions rule error
/* eslint-disable no-unused-expressions */

/**
 * Preview widget at the top of the panel menu.
 */
class PreviewWidget extends St.Bin {
    static [GObject.GTypeName] = 'PreviewWidget';

    static {
        GObject.registerClass(this);
    }

    private readonly previewWidth: number;
    private readonly previewHeight: number;

    /**
     * Create a PreviewWidget
     *
     * @param {number} width Width of the loaded preview image.
     */
    constructor(width: number) {
        let aspect;
        // @ts-expect-error Members of 'Main' are not defined completely for TS
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (Main.layoutManager?.primaryMonitor?.height)
            // @ts-expect-error Members of 'Main' are not defined completely for TS
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            aspect = Main.layoutManager.primaryMonitor.height / Main.layoutManager.primaryMonitor.width;
        else
            aspect = 2 / (1 + Math.sqrt(5)); // inverse of golden ratio: https://en.wikipedia.org/wiki/Golden_ratio

        const height = width * aspect;

        super({
            style_class: 'rwg-preview-image',
            x_expand: true,
            height,
        });

        this.previewWidth = width;
        this.previewHeight = height;
    }

    /**
     * Show the image from the provided path in the widget
     *
     * @param {string} path Path to the image to preview
     */
    preview(path: string | null): void {
        if (!path)
            return;

        try {
            const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, this.previewWidth, this.previewHeight);
            const height = pixbuf.get_height();
            const width = pixbuf.get_width();

            const image = new Clutter.Image();
            const pixelFormat = pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888;
            image.set_data(
                pixbuf.get_pixels(),
                pixelFormat,
                width,
                height,
                pixbuf.get_rowstride()
            );

            const imageActor = new St.Bin({
                height,
                width,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
            });
            imageActor.set_content(image);

            this.set_child(imageActor);
        } catch (exception) {
            Logger.error(String(exception), this);
        }
    }
}

/**
 * Simple sub-menu separator item because the existing PopupSeparatorMenuItem from does not look right in a sub-menu.
 */
class HistoryElementSubmenuSeparator extends PopupMenu.PopupBaseMenuItem {
    static [GObject.GTypeName] = 'HistoryElementSubmenuSeparator';

    static {
        GObject.registerClass(this);
    }

    /**
     * Create a new sub-menu separator item.
     */
    constructor() {
        super();

        this.sensitive = false;
        this.x_expand = true;

        const line = new St.BoxLayout({
            style_class: 'rwg-submenu-separator',
            height: 1,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.actor.add_child(line);
    }
}

/**
 * Shell menu item holding information related to a HistoryEntry
 */
class HistoryElement extends PopupMenu.PopupSubMenuMenuItem {
    static [GObject.GTypeName] = 'HistoryElement';

    static {
        GObject.registerClass(this);
    }

    private _settings = new Settings.Settings();

    private _prefixLabel;
    private _container;
    private _dateLabel;

    protected _setAsWallpaperItem;

    historyId: string;
    historyEntry: HistoryModule.HistoryEntry;

    /**
     * Create a new menu element for a HistoryEntry.
     *
     * @param {HistoryModule.HistoryEntry} historyEntry HistoryEntry this menu element serves
     * @param {number} index Place in history
     */
    constructor(historyEntry: HistoryModule.HistoryEntry, index: number) {
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

        if (this.historyEntry.source !== null) {
            if (this.historyEntry.source.author !== null &&
                this.historyEntry.source.authorUrl !== null) {
                const authorItem = new PopupMenu.PopupMenuItem(`Image By: ${this.historyEntry.source.author}`);
                authorItem.connect('activate', () => {
                    if (this.historyEntry.source.authorUrl) {
                        Utils.execCheck(['xdg-open', this.historyEntry.source.authorUrl]).catch(error => {
                            Logger.error(error, this);
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
                            Logger.error(error, this);
                        });
                    }
                });

                this.menu.addMenuItem(sourceItem);
            }

            const imageUrlItem = new PopupMenu.PopupMenuItem('Open Image In Browser');
            imageUrlItem.connect('activate', () => {
                if (this.historyEntry.source.imageLinkUrl) {
                    Utils.execCheck(['xdg-open', this.historyEntry.source.imageLinkUrl]).catch(error => {
                        Logger.error(error, this);
                    });
                }
            });

            this.menu.addMenuItem(imageUrlItem);
        } else {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Unknown source.'));
        }

        this.menu.addMenuItem(new HistoryElementSubmenuSeparator());

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
                Logger.error(error, this);
            });
        });
        this.menu.addMenuItem(copyToFavorites);

        this.menu.addMenuItem(new HistoryElementSubmenuSeparator());

        // Static URLs can't block images (yet?)
        if (this.historyEntry.adapter?.type !== Utils.SourceType.STATIC_URL) {
            const blockImage = new PopupMenu.PopupMenuItem('Add To Blocklist');
            blockImage.connect('activate', () => {
                this._addToBlocklist();
            });
            this.menu.addMenuItem(blockImage);
        }
    }

    private static debounceID: number = -1;
    private static readonly DEBOUNCE_DELAY: number = 150;
    /**
     * Debounce events based on incremented debounceID. I.e. Only the last promise created resolves when the timeout finishes.
     *
     * @returns {Promise<void>} The debounce promise
     */
    debounce(): Promise<void> {
        HistoryElement.debounceID++;
        // Warp ids and ignore issues when more events are queued than the ID period.
        HistoryElement.debounceID %= 65536;

        return new Promise(resolve => {
            const debounceID = HistoryElement.debounceID;
            setTimeout(() => {
                if (debounceID === HistoryElement.debounceID)
                    resolve();
            }, HistoryElement.DEBOUNCE_DELAY);
        });
    }

    /**
     * Set callbacks to be called on the enter, leave, and select events.
     *
     * @param {(HistoryElement) => void} onEnter Function to call on menu element key-focus-in
     * @param {(HistoryElement) => void} onLeave Function to call on menu element key-focus-out
     * @param {(HistoryElement) => void} onSelect Function to call on menu element enter-event
     */
    public setCallbacks(
        onEnter: (entry: HistoryModule.HistoryEntry) => void,
        onLeave: (entry: HistoryModule.HistoryEntry) => void,
        onSelect: (entry: HistoryModule.HistoryEntry) => void
    ): void {
        const connect_events = (element: Clutter.Actor): void => {
            element.connect('key-focus-in', () => void this.debounce().then(() => onEnter(this.historyEntry)).catch(err => Logger.error(err, this)));
            element.connect('key-focus-out', () => void this.debounce().then(() => onLeave(this.historyEntry)).catch(err => Logger.error(err, this)));
            element.connect('enter-event', () => void this.debounce().then(() => onEnter(this.historyEntry)).catch(err => Logger.error(err, this)));
            element.connect('leave-event', () => void this.debounce().then(() => onLeave(this.historyEntry)).catch(err => Logger.error(err, this)));
        };

        connect_events(this.actor);

        // the sub menu container only reacts to mouse events. Thus, we hook up the events to all menuItems.
        for (const menuItem of this.menu.box.get_children())
            connect_events(menuItem);

        // Add events to the sub-menu container to handle non-sensitive children correctly
        connect_events(this.menu.actor);
        // Also execute the leave callback when sub-menu is closed.
        // Note that this is a workaround for the enter event being triggered as the last event for some reason.
        this.menu.connect('open-state-changed', (_, open) => void this.debounce().then(() => {
            if (!open)
                onLeave(this.historyEntry);
        }).catch(err => Logger.error(err, this)));

        this.connect('activate', () => onSelect(this.historyEntry));
    }

    /**
     * Add an image to the blocking list.
     *
     * Uses the filename for distinction.
     */
    private _addToBlocklist(): void {
        if (!this.historyEntry.adapter?.id || this.historyEntry.adapter.id === '-1' || !this.historyEntry.name) {
            Logger.error('Image entry is missing information', this);
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
            if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) // noop
                Logger.debug('Folder already exists.', this);
            else // escalate
                throw error;
        }

        if (!await sourceFile.copy_async(targetFile, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, null, null))
            throw new Error('Failed copying image.');

        // https://gjs.guide/guides/gio/file-operations.html#writing-file-contents
        const [success, message]: [boolean, string | null] = targetInfoFile.replace_contents(
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
}

/**
 * Special shell menu element for the current wallpaper HistoryEntry
 */
class CurrentImageElement extends HistoryElement {
    static [GObject.GTypeName] = 'CurrentImageElement';

    static {
        GObject.registerClass(this);
    }

    /**
     * Create a new image element for the currently active wallpaper.
     *
     * @param {HistoryModule.HistoryEntry} historyEntry History entry this menu is for
     */
    constructor(historyEntry: HistoryModule.HistoryEntry) {
        super(historyEntry, 0);

        if (this._setAsWallpaperItem)
            this._setAsWallpaperItem.destroy();
    }
}

/**
 * Element for the "New Wallpaper" button and the remaining time for the auto fetch
 * feature.
 * The remaining time will only be displayed if the af-feature is activated.
 */
class NewWallpaperElement extends PopupMenu.PopupBaseMenuItem {
    static [GObject.GTypeName] = 'NewWallpaperElement';

    static {
        GObject.registerClass(this);
    }

    private _timer = Timer.getTimer();
    private _remainingLabel;

    /**
     * Create a button for fetching new wallpaper
     */
    constructor() {
        super(undefined);

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
        if (this._timer.isEnabled()) {
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
}

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
        // @ts-expect-error Don't know where this is defined
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
    private _historySectionCache = new Map<string, HistoryElement>();
    private _historyCache: HistoryModule.HistoryEntry[] = [];

    /**
     * Create a new history section.
     */
    constructor() {
        super();

        this.actor = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
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
        onEnter: (actor: HistoryModule.HistoryEntry) => void,
        onLeave: (actor: HistoryModule.HistoryEntry) => void,
        onSelect: (actor: HistoryModule.HistoryEntry) => void
    ): void {
        if (this._historyCache.length <= 1)
            this.removeAll(); // remove empty history element

        const existingHistoryElements = [];

        for (let i = 1; i < history.length; i++) {
            const historyID = history[i].id;

            if (!historyID)
                continue;

            const cachedHistoryElement = this._historySectionCache.get(historyID);
            if (!cachedHistoryElement) {
                const newHistoryElement = new HistoryElement(history[i], i);
                newHistoryElement.setCallbacks(onEnter, onLeave, onSelect);

                this._historySectionCache.set(historyID, newHistoryElement);

                this.addMenuItem(newHistoryElement, i - 1);
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
    HistoryElement,
    PreviewWidget
};
