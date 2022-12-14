import * as GdkPixbuf from 'gi://GdkPixbuf';
import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';
import * as GObject from 'gi://GObject';
import * as Gtk from 'gi://Gtk';

import * as Clutter from '@gi-types/clutter';
import * as Cogl from '@gi-types/cogl';
import * as St from '@gi-types/st';

import * as PopupMenu from '@gi/ui/popupMenu';

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

    constructor(params: object | undefined, historyEntry: HistoryModule.HistoryEntry, index: number) {
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
                    if (this.historyEntry.source.authorUrl)
                        Utils.execCheck(['xdg-open', this.historyEntry.source.authorUrl]).catch(this._logger.error);
                });

                this.menu.addMenuItem(authorItem);
            }

            if (this.historyEntry.source.source !== null &&
                this.historyEntry.source.sourceUrl !== null) {
                const sourceItem = new PopupMenu.PopupMenuItem(`Image From: ${this.historyEntry.source.source}`);
                sourceItem.connect('activate', () => {
                    if (this.historyEntry.source.sourceUrl)
                        Utils.execCheck(['xdg-open', this.historyEntry.source.sourceUrl]).catch(this._logger.error);
                });

                this.menu.addMenuItem(sourceItem);
            }

            const imageUrlItem = new PopupMenu.PopupMenuItem('Open Image In Browser');
            imageUrlItem.connect('activate', () => {
                if (this.historyEntry.source.imageLinkUrl)
                    Utils.execCheck(['xdg-open', this.historyEntry.source.imageLinkUrl]).catch(this._logger.error);
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
            this._saveImage().catch(this._logger.error);
        });
        this.menu.addMenuItem(copyToFavorites);

        // Static URLs can't block images (yet?)
        if (this.historyEntry.adapter?.type !== 5) {
            const blockImage = new PopupMenu.PopupMenuItem('Add To Blocklist');
            blockImage.connect('activate', () => {
                this._addToBlocklist(this.historyEntry);
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

    private _addToBlocklist(entry: HistoryModule.HistoryEntry) {
        if (!entry.adapter?.id || entry.adapter.id === '-1' || !entry.name) {
            this._logger.error('Image entry is missing information');
            return;
        }

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${entry.adapter.id}/`;
        const generalSettings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);
        const blockedFilenames = generalSettings.getStrv('blocked-images');

        if (blockedFilenames.includes(entry.name))
            return;

        blockedFilenames.push(entry.name);
        generalSettings.setStrv('blocked-images', blockedFilenames);
    }

    private async _saveImage() {
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
            if (error === Gio.IOErrorEnum.EXISTS) { /** noop */ }
        }

        // This function was rewritten by Gio._promisify
        // @ts-expect-error
        if (!await sourceFile.copy_async(targetFile, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, null, null))
            throw new Error('Failed copying image.');

        // https://gjs.guide/guides/gio/file-operations.html#writing-file-contents
        // This function was rewritten by Gio._promisify
        // @ts-expect-error
        const [success, message]: [boolean, string] = await targetInfoFile.replace_contents_bytes_async(
            // @ts-expect-error Don't know from where to import
            new TextEncoder().encode(JSON.stringify(this.historyEntry.source, null, '\t')),
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null);

        if (!success)
            throw new Error(`Failed writing file contents: ${message}`);
    }

    setIndex(index: number) {
        this._prefixLabel.set_text(`${String(index)}.`);
    }
});

const CurrentImageElement = GObject.registerClass({
    GTypeName: 'CurrentImageElement',
}, class CurrentImageElement extends HistoryElement {
    constructor(params: object | undefined, historyEntry: HistoryModule.HistoryEntry) {
        super(params, historyEntry, 0);

        if (this._setAsWallpaperItem)
            this._setAsWallpaperItem.destroy();
    }
});

/**
 * Element for the New Wallpaper button and the remaining time for the auto fetch
 * feature.
 * The remaining time will only be displayed if the af-feature is activated.
 */
const NewWallpaperElement = GObject.registerClass({
    GTypeName: 'NewWallpaperElement',
},
class NewWallpaperElement extends PopupMenu.PopupBaseMenuItem {
    private _timer = Timer.getTimer();
    private _remainingLabel;

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

    show() {
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

class StatusElement {
    icon;

    constructor() {
        this.icon = new St.Icon({
            icon_name: 'preferences-desktop-wallpaper-symbolic',
            style_class: 'system-status-icon',
        });
    }

    startLoading() {
        // @ts-expect-error Don't know where this is defined
        this.icon.ease({
            opacity: 20,
            duration: 1337,
            mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
            autoReverse: true,
            repeatCount: -1,
        });
    }

    stopLoading() {
        this.icon.remove_all_transitions();
        this.icon.opacity = 255;
    }
}

class HistorySection extends PopupMenu.PopupMenuSection {
    /**
     * Cache HistoryElements for performance of long histories.
     */
    private _historySectionCache = new Map<string, typeof HistoryElement>();
    private _historyCache: HistoryModule.HistoryEntry[] = [];

    constructor() {
        super();

        this.actor = new St.ScrollView({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        });

        this.actor.add_actor(this.box);
    }

    // eslint-disable-next-line no-unused-vars
    updateList(history: HistoryModule.HistoryEntry[], onEnter: (actor: typeof HistoryElement) => void, onLeave: (actor: typeof HistoryElement) => void, onSelect: (actor: typeof HistoryElement) => void) {
        if (this._historyCache.length <= 1)
            this.removeAll(); // remove empty history element

        const existingHistoryElements = [];

        for (let i = 1; i < history.length; i++) {
            const historyID = history[i].id;

            if (!historyID)
                continue;

            // Typing fails here for our own class derived from GObject.registerClass
            // FIXME: Expect a whole lot of ignore comments here:

            let cachedHistoryElement = this._historySectionCache.get(historyID);
            if (!cachedHistoryElement) {
                // @ts-expect-error
                cachedHistoryElement = new HistoryElement(undefined, history[i], i);
                // @ts-expect-error
                cachedHistoryElement.actor.connect('key-focus-in', onEnter);
                // @ts-expect-error
                cachedHistoryElement.actor.connect('key-focus-out', onLeave);
                // @ts-expect-error
                cachedHistoryElement.actor.connect('enter-event', onEnter);

                // @ts-expect-error
                cachedHistoryElement.connect('activate', onSelect);
                // @ts-expect-error
                this._historySectionCache.set(historyID, cachedHistoryElement);

                // @ts-expect-error
                this.addMenuItem(cachedHistoryElement, i - 1);
            } else {
                // @ts-expect-error
                cachedHistoryElement.setIndex(i);
            }

            existingHistoryElements.push(historyID);
        }

        this._cleanupHistoryCache(existingHistoryElements);
        this._historyCache = history;
    }

    private _cleanupHistoryCache(existingIDs: string[]) {
        const destroyIDs = Array.from(this._historySectionCache.keys()).filter(i => existingIDs.indexOf(i) === -1);

        destroyIDs.forEach(id => {
            // Same as the block above, typing from GObject.registerClass fails
            // @ts-expect-error
            this._historySectionCache.get(id)?.destroy();
            this._historySectionCache.delete(id);
        });
    }

    clear() {
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
