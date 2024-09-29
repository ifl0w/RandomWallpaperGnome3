import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';
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

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
const [MAJOR, unused_MINOR] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

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

        const prefixText = `${String(index + 1)}.`;
        this._prefixLabel = new St.Label({
            text: prefixText,
            style_class: 'rwg-history-index',
        });

        this.actor.insert_child_above(this._prefixLabel, this.label);
        this.label.destroy();

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

            const imageUrlItem = new PopupMenu.PopupMenuItem(_('Open Image in Browser'));
            imageUrlItem.connect('activate', () => {
                if (this.historyEntry.source.imageLinkUrl) {
                    Utils.execCheck(['xdg-open', this.historyEntry.source.imageLinkUrl]).catch(error => {
                        Logger.error(error, this);
                    });
                }
            });

            this.menu.addMenuItem(imageUrlItem);
        } else {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_('Unknown Source')));
        }

        this.menu.addMenuItem(new HistoryElementSubmenuSeparator());

        this._setAsWallpaperItem = new PopupMenu.PopupMenuItem(_('Set As Wallpaper'));
        this._setAsWallpaperItem.connect('activate', () => {
            this.emit('activate', null); // Fixme: not sure what the second parameter should be. null seems to work fine for now.
        });

        this.menu.addMenuItem(this._setAsWallpaperItem);

        const copyToFavoritesLabelText = _('Save for Later');
        const copyToFavorites = new PopupMenu.PopupMenuItem(copyToFavoritesLabelText);
        copyToFavorites.connect('activate', () => {
            this._saveImage().catch(error => {
                Logger.error(error, this);
            });
        });
        // Disable copy option if the file was already saved.
        this.menu.connect('open-state-changed', (_unused, open) => {
            if (open && this._checkAlreadySaved()) {
                copyToFavorites.sensitive = false;
                copyToFavorites.label.set_text(_('Already Saved!'));
            } else {
                copyToFavorites.sensitive = true;
                copyToFavorites.label.set_text(copyToFavoritesLabelText);
            }
        });
        this.menu.addMenuItem(copyToFavorites);

        this.menu.addMenuItem(new HistoryElementSubmenuSeparator());

        // Static URLs can't block images (yet?)
        if (this.historyEntry.adapter?.type !== Utils.SourceType.STATIC_URL) {
            const blockImage = new PopupMenu.PopupMenuItem(_('Add to Blocklist'));
            blockImage.connect('activate', () => {
                this._addToBlocklist();
            });
            this.menu.addMenuItem(blockImage);
        }

        // The private function _needsScrollbar defines whether a scrollbar is added to the sub-menu.
        // It is overwritten here since this forces the sub-menu to expand to its natural height.
        // Otherwise, with long histories, the scrollView is very narrow and scrolling in it isn't really possible.
        // The outer scrollView encapsulating all history entries should be the only scrollable element.
        // Source: https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/c76b18a04282e48f6196ad1f9f1ab6f08c492599/js/ui/popupMenu.js#L1028-1035
        //
        // FIXME: Need to find a proper solution to this problem since this approach might eventually break. Setting "max-height" in CSS
        // on the right element should work as well but didn't work for me for some reason.
        // @ts-expect-error private function overwritten
        this.menu._needsScrollbar = (): boolean => {
            return false;
        };
        // Disable scrolling in inner scrollView.
        // This causes the outer scrollView to be the only scrollable area.
        this.menu.actor.enableMouseScrolling = false;
    }

    private static readonly DEBOUNCE_DELAY: number = 150;
    private static readonly DEBOUNCE_ERROR_MSG: string = 'debounce';
    private static debounceID: number = -1;
    private static clearLastDebounceTimeout: (() => void) | undefined;
    private static lastDebounceTimeout: number | undefined;
    /**
     * Debounce events based on incremented debounceID. I.e. Only the last promise created resolves when the timeout finishes.
     *
     * @returns {Promise<void>} The debounce promise
     */
    debounce(): Promise<void> {
        HistoryElement.debounceID++;
        // Warp ids and ignore issues when more events are queued than the ID period.
        HistoryElement.debounceID %= 65536;

        return new Promise((resolve, reject) => {
            const debounceID = HistoryElement.debounceID;

            HistoryElement.cleanupDebounce();

            // set up timeout
            HistoryElement.lastDebounceTimeout = setTimeout(() => {
                if (debounceID === HistoryElement.debounceID)
                    resolve();
                else
                    reject(new Error(HistoryElement.DEBOUNCE_ERROR_MSG));

                HistoryElement.lastDebounceTimeout = undefined;
                HistoryElement.clearLastDebounceTimeout = undefined;
            }, HistoryElement.DEBOUNCE_DELAY);

            // set up cleanup function
            HistoryElement.clearLastDebounceTimeout = (): void => {
                reject(new Error(HistoryElement.DEBOUNCE_ERROR_MSG));
            };
        });
    }

    /**
     * Remove and cleanup any running debounce timeout.
     */
    public static cleanupDebounce(): void {
        // clear last timeout if it exists
        if (HistoryElement.lastDebounceTimeout)
            clearTimeout(HistoryElement.lastDebounceTimeout);

        // call cleanup function of latest timeout
        if (HistoryElement.clearLastDebounceTimeout)
            HistoryElement.clearLastDebounceTimeout();

        HistoryElement.lastDebounceTimeout = undefined;
        HistoryElement.clearLastDebounceTimeout = undefined;
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
        const debounceCatch = (err: Error): void => {
            if (err.message !== HistoryElement.DEBOUNCE_ERROR_MSG)
                Logger.error(err, this);
        };

        const connect_events = (element: Clutter.Actor): void => {
            element.connect('key-focus-in', () => void this.debounce().then(() => onEnter(this.historyEntry)).catch(debounceCatch));
            element.connect('key-focus-out', () => void this.debounce().then(() => onLeave(this.historyEntry)).catch(debounceCatch));
            element.connect('enter-event', () => void this.debounce().then(() => onEnter(this.historyEntry)).catch(debounceCatch));
            element.connect('leave-event', () => void this.debounce().then(() => onLeave(this.historyEntry)).catch(debounceCatch));
        };

        connect_events(this.actor);

        // the sub menu container only reacts to mouse events. Thus, we hook up the events to all menuItems.
        for (const menuItem of this.menu.box.get_children())
            connect_events(menuItem);

        // Add events to the sub-menu container to handle non-sensitive children correctly
        connect_events(this.menu.actor);
        // Also execute the leave callback when sub-menu is closed.
        // Note that this is a workaround for the enter event being triggered as the last event for some reason.
        this.menu.connect('open-state-changed', (_unused, open) => void this.debounce().then(() => {
            if (!open)
                onLeave(this.historyEntry);
        }).catch(debounceCatch));

        this.connect('activate', () => {
            HistoryElement.cleanupDebounce();
            onSelect(this.historyEntry);
        });
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
     * Checks if the file of this history entry was already saved.
     *
     * @returns {boolean} Whether the target file exists already.
     */
    private _checkAlreadySaved(): boolean {
        if (!this.historyEntry || !this.historyEntry.name)
            return false;

        const targetFolder = Gio.File.new_for_path(this._settings.getString('favorites-folder'));
        const targetFile = targetFolder.get_child(this.historyEntry.name);

        return targetFile.query_exists(null);
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
            text: _('New Wallpaper'),
            style_class: 'rwg-new-label',
        });
        container.add_child(newWPLabel);

        this._remainingLabel = new St.Label();
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

            const hoursText = ngettext('%d hour', '%d hours', hours).format(hours);
            const minText = ngettext('%d minute', '%d minutes', minutes).format(minutes);

            if (hours >= 1)
                this._remainingLabel.text = `... ${hoursText} ${_('and')} ${minText} ${_('remaining')}.`;
            else
                this._remainingLabel.text = `... ${minText} ${_('remaining')}.`;


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
     * Create a new history section.
     */
    constructor() {
        super();

        this.actor = new St.ScrollView({
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
        });

        // https://gjs.guide/extensions/upgrading/gnome-shell-46.html#clutter-container
        if (MAJOR < 46)
            this.actor.add_actor(this.box);
        else
            this.actor.add_child(this.box);
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
        this.removeAll();

        for (let i = 0; i < history.length; i++) {
            const historyID = history[i].id;

            if (!historyID)
                continue;

            const newHistoryElement = new HistoryElement(history[i], i);
            newHistoryElement.setCallbacks(onEnter, onLeave, onSelect);

            this.addMenuItem(newHistoryElement, i);
        }
    }

    /**
     * Clear and remove all history elements.
     */
    clear(): void {
        // ensure UI debounce timeouts are cleaned up
        HistoryElement.cleanupDebounce();

        this.removeAll();

        const noHistory = new PopupMenu.PopupMenuItem(_('No Wallpaper History'));
        noHistory.sensitive = false;
        this.addMenuItem(noHistory);
    }
}

export {
    StatusElement,
    NewWallpaperElement,
    HistorySection,
    HistoryElement,
    PreviewWidget
};
