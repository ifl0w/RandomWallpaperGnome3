import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Settings from './../settings.js';
import * as Utils from './../utils.js';

import {Logger} from './../logger.js';

import {GenericJsonSettingsGroup} from './genericJson.js';
import {LocalFolderSettingsGroup} from './localFolder.js';
import {RedditSettingsGroup} from './reddit.js';
import {UnsplashSettingsGroup} from './unsplash.js';
import {UrlSourceSettingsGroup} from './urlSource.js';
import {WallhavenSettingsGroup} from './wallhaven.js';

// FIXME: Generated static class code produces a no-unused-expressions rule error
/* eslint-disable no-unused-expressions */

/**
 * Class containing general settings for each adapter source as well as the adapter source
 */
class SourceRow extends Adw.ExpanderRow {
    static [GObject.GTypeName] = 'SourceRow';
    // @ts-expect-error Gtk.template is not in the type definitions files yet
    static [Gtk.template] = GLib.uri_resolve_relative(import.meta.url, './sourceRow.ui', GLib.UriFlags.NONE);
    // @ts-expect-error Gtk.children is not in the type definitions files yet
    static [Gtk.children] = [
        'button_delete',
    ];

    // @ts-expect-error Gtk.internalChildren is not in the type definitions files yet
    static [Gtk.internalChildren] = [
        'blocked_images_list',
        'combo',
        'settings_container',
        'source_name',
    ];

    static {
        GObject.registerClass(this);
    }

    // This list is the same across all rows
    static _stringList: Gtk.StringList;

    // Children
    button_delete!: Gtk.Button;

    // InternalChildren
    private _blocked_images_list!: Adw.ExpanderRow;
    private _combo!: Adw.ComboRow;
    private _settings_container!: Adw.Clamp;
    private _source_name!: Adw.EntryRow;

    private _settings;

    id = String(Date.now());

    /**
     * Craft a new source row using an unique ID.
     *
     * Default unique ID is Date.now()
     * Previously saved settings will be used if the ID matches.
     *
     * @param {Partial<Adw.ExpanderRow.ConstructorProperties> | undefined} params Properties for Adw.ExpanderRow or undefined
     * @param {string | null} id Unique ID or null
     */
    constructor(params: Partial<Adw.ExpanderRow.ConstructorProperties> | undefined, id?: string | null) {
        super(params);

        if (id)
            this.id = id;

        const path = `${Settings.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${this.id}/`;
        this._settings = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL, path);

        if (!SourceRow._stringList) {
            const availableTypeNames: string[] = [];

            // Fill combo from enum
            // https://stackoverflow.com/a/39372911
            for (const type in Utils.SourceType) {
                if (isNaN(Number(type)))
                    continue;

                availableTypeNames.push(Utils.getSourceTypeName(Number(type)));
            }

            SourceRow._stringList = Gtk.StringList.new(availableTypeNames);
        }
        this._combo.model = SourceRow._stringList;
        this._combo.selected = this._settings.getInt('type');

        this._settings.bind('name',
            this._source_name,
            'text',
            Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('enabled',
            this,
            'enable-expansion',
            Gio.SettingsBindFlags.DEFAULT);

        this._combo.connect('notify::selected', (comboRow: Adw.ComboRow) => {
            this._settings.setInt('type', comboRow.selected);
            this._fillRow(comboRow.selected);
        });

        this._fillRow(this._combo.selected);

        const blockedImages: string[] = this._settings.getStrv('blocked-images');
        blockedImages.forEach(filename => {
            const blockedImageRow = new Adw.ActionRow();
            blockedImageRow.set_title(filename);

            const button = new Gtk.Button();
            button.set_valign(Gtk.Align.CENTER);
            button.connect('clicked', () => {
                this._removeBlockedImage(filename);
                this._blocked_images_list.remove(blockedImageRow);
            });

            const buttonContent = new Adw.ButtonContent();
            buttonContent.set_icon_name('user-trash-symbolic');

            button.set_child(buttonContent);
            blockedImageRow.add_suffix(button);
            this._blocked_images_list.add_row(blockedImageRow);
            this._blocked_images_list.set_sensitive(true);
        });
    }

    /**
     * Fill this source row with adapter settings.
     *
     * @param {number} type Enum of the adapter to use
     */
    private _fillRow(type: number): void {
        const targetWidget = this._getSettingsGroup(type);
        if (targetWidget !== null)
            this._settings_container.set_child(targetWidget);
    }

    /**
     * Get a new adapter based on an enum source type.
     *
     * @param {Utils.SourceType} type Enum of the adapter to get
     * @returns {UnsplashSettingsGroup | WallhavenSettingsGroup | RedditSettingsGroup | GenericJsonSettingsGroup | LocalFolderSettingsGroup | UrlSourceSettingsGroup | null} Newly crafted adapter or null
     */
    private _getSettingsGroup(type: Utils.SourceType = Utils.SourceType.UNSPLASH): UnsplashSettingsGroup
        | WallhavenSettingsGroup
        | RedditSettingsGroup
        | GenericJsonSettingsGroup
        | LocalFolderSettingsGroup
        | UrlSourceSettingsGroup
        | null {
        let targetWidget = null;
        switch (type) {
        case Utils.SourceType.UNSPLASH:
            targetWidget = new UnsplashSettingsGroup(undefined, this.id);
            break;
        case Utils.SourceType.WALLHAVEN:
            targetWidget = new WallhavenSettingsGroup(undefined, this.id);
            break;
        case Utils.SourceType.REDDIT:
            targetWidget = new RedditSettingsGroup(undefined, this.id);
            break;
        case Utils.SourceType.GENERIC_JSON:
            targetWidget = new GenericJsonSettingsGroup(undefined, this.id);
            break;
        case Utils.SourceType.LOCAL_FOLDER:
            targetWidget = new LocalFolderSettingsGroup(undefined, this.id);
            break;
        case Utils.SourceType.STATIC_URL:
            targetWidget = new UrlSourceSettingsGroup(undefined, this.id);
            break;
        default:
            targetWidget = null;
            Logger.error('The selected source has no corresponding widget!', this);
            break;
        }
        return targetWidget;
    }

    /**
     * Remove an image name from the blocked image list.
     *
     * @param {string} filename Image name to remove
     */
    private _removeBlockedImage(filename: string): void {
        let blockedImages = this._settings.getStrv('blocked-images');
        if (!blockedImages.includes(filename))
            return;


        blockedImages = Utils.removeItemOnce(blockedImages, filename);
        this._settings.setStrv('blocked-images', blockedImages);
    }

    /**
     * Clear all keys associated to this ID across all adapter
     */
    clearConfig(): void {
        for (const i of Array(6).keys()) {
            const widget = this._getSettingsGroup(i);
            if (widget)
                widget.clearConfig();
        }

        this._settings.resetSchema();
    }
}

export {SourceRow};
