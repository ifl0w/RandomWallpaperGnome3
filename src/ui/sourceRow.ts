import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

// Legacy importing style for shell internal bindings not available in standard import format
const ExtensionUtils = imports.misc.extensionUtils;

import * as Settings from './../settings.js';
import * as Utils from './../utils.js';

import {Logger} from './../logger.js';

import {GenericJsonSettingsGroup} from './genericJson.js';
import {LocalFolderSettingsGroup} from './localFolder.js';
import {RedditSettingsGroup} from './reddit.js';
import {UnsplashSettingsGroup} from './unsplash.js';
import {UrlSourceSettingsGroup} from './urlSource.js';
import {WallhavenSettingsGroup} from './wallhaven.js';

const Self = ExtensionUtils.getCurrentExtension();

// https://gitlab.gnome.org/GNOME/gjs/-/blob/master/examples/gtk4-template.js
const SourceRow = GObject.registerClass({
    GTypeName: 'SourceRow',
    Template: GLib.filename_to_uri(`${Self.path}/ui/sourceRow.ui`, null),
    Children: [
        'button_delete',
    ],
    InternalChildren: [
        'blocked_images_list',
        'combo',
        'settings_container',
        'source_name',
    ],
}, class SourceRow extends Adw.ExpanderRow {
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
    private _logger = new Logger('RWG3', 'SourceRow');

    id = String(Date.now());

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

    private _fillRow(type: number): void {
        const targetWidget = this._getSettingsGroup(type);
        if (targetWidget !== null)
            this._settings_container.set_child(targetWidget);
    }

    private _getSettingsGroup(type = 0): GObject.RegisteredPrototype<InstanceType<typeof UnsplashSettingsGroup>, { [key: string]: GObject.ParamSpec<unknown>; }, unknown[]>
     | GObject.RegisteredPrototype<InstanceType<typeof WallhavenSettingsGroup>, { [key: string]: GObject.ParamSpec<unknown>; }, unknown[]>
     | GObject.RegisteredPrototype<InstanceType<typeof RedditSettingsGroup>, { [key: string]: GObject.ParamSpec<unknown>; }, unknown[]>
     | GObject.RegisteredPrototype<InstanceType<typeof GenericJsonSettingsGroup>, { [key: string]: GObject.ParamSpec<unknown>; }, unknown[]>
     | GObject.RegisteredPrototype<InstanceType<typeof LocalFolderSettingsGroup>, { [key: string]: GObject.ParamSpec<unknown>; }, unknown[]>
     | GObject.RegisteredPrototype<InstanceType<typeof UrlSourceSettingsGroup>, { [key: string]: GObject.ParamSpec<unknown>; }, unknown[]>
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
            this._logger.error('The selected source has no corresponding widget!');
            break;
        }
        return targetWidget;
    }

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
});

export {SourceRow};
