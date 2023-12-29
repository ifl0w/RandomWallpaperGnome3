import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import * as Utils from './../utils.js';

import {Logger} from './../logger.js';
import {SourceRow} from './sourceRow.js';

import {GenericJsonSettingsGroup} from './genericJson.js';
import {LocalFolderSettingsGroup} from './localFolder.js';
import {RedditSettingsGroup} from './reddit.js';
import {UnsplashSettingsGroup} from './unsplash.js';
import {UrlSourceSettingsGroup} from './urlSource.js';
import {WallhavenSettingsGroup} from './wallhaven.js';

// FIXME: Generated static class code produces a no-unused-expressions rule error
/* eslint-disable no-unused-expressions */

/**
 * Subclass of Adw.Window for configuring a single source in a modal window.
 */
class SourceConfigModal extends Adw.Window {
    static [GObject.GTypeName] = 'SourceConfigModal';
    // @ts-expect-error Gtk.template is not in the type definitions files yet
    static [Gtk.template] = GLib.uri_resolve_relative(import.meta.url, './sourceConfigModal.ui', GLib.UriFlags.NONE);
    // @ts-expect-error Gtk.children is not in the type definitions files yet
    static [Gtk.children] = [
    ];

    // @ts-expect-error Gtk.children is not in the type definitions files yet
    static [Gtk.internalChildren] = [
        'combo',
        'settings_container',
        'source_name',
        'button_add',
        'button_cancel',
        'button_close',
    ];

    static {
        GObject.registerClass(this);
    }

    // This list is the same across all rows
    static _stringList: Gtk.StringList;

    private _combo!: Adw.ComboRow;
    private _settings_container!: Adw.PreferencesGroup;
    private _source_name!: Adw.EntryRow;
    private _button_add!: Gtk.Button;
    private _button_cancel!: Gtk.Button;
    private _button_close!: Gtk.Button;

    private _currentSourceRow: SourceRow;
    private _currentSourceWidget?: Gtk.Widget;

    /**
     * Craft a new source row using an unique ID.
     *
     * Default unique ID is Date.now()
     * Previously saved settings will be used if the ID matches.
     *
     * @param {Adw.Window} parentWindow The window that this model is transient for.
     * @param {SourceRow} source Optional SourceRow object for editing if not present a new SourceRow will be created.
     */
    constructor(parentWindow: Adw.Window, source?: SourceRow) {
        super({
            title: source ? 'Edit Source' : 'Add New Source',
            transient_for: parentWindow,
            modal: true,
            defaultHeight: parentWindow.get_height() * 0.9,
            defaultWidth: parentWindow.get_width() * 0.9,
        });

        if (!source) {
            this._currentSourceRow = new SourceRow();
            this._button_cancel.show();
            this._button_add.show();
            this._button_close.hide();
        } else {
            this._currentSourceRow = source;
            this._button_cancel.hide();
            this._button_add.hide();
            this._button_close.show();
        }

        if (!SourceConfigModal._stringList) {
            const availableTypeNames: string[] = [];

            // Fill combo from enum
            // https://stackoverflow.com/a/39372911
            for (const type in Utils.SourceType) {
                if (isNaN(Number(type)))
                    continue;

                availableTypeNames.push(Utils.getSourceTypeName(Number(type)));
            }

            SourceConfigModal._stringList = Gtk.StringList.new(availableTypeNames);
        }
        this._combo.model = SourceConfigModal._stringList;
        this._combo.selected = this._currentSourceRow.settings.getInt('type');

        this._currentSourceRow.settings.bind('name',
            this._source_name,
            'text',
            Gio.SettingsBindFlags.DEFAULT);

        this._combo.connect('notify::selected', (comboRow: Adw.ComboRow) => {
            this._currentSourceRow.settings.setInt('type', comboRow.selected);
            this._fillRow(comboRow.selected);
        });

        this._fillRow(this._combo.selected);
    }

    /**
     * Fill this source row with adapter settings.
     *
     * @param {number} type Enum of the adapter to use
     */
    private _fillRow(type: number): void {
        const targetWidget = this._getSettingsGroup(type);
        if (targetWidget !== null) {
            if (this._currentSourceWidget)
                this._settings_container.remove(this._currentSourceWidget);

            this._settings_container.add(targetWidget);
            this._currentSourceWidget = targetWidget;
        }
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
            targetWidget = new UnsplashSettingsGroup(this._currentSourceRow.id);
            break;
        case Utils.SourceType.WALLHAVEN:
            targetWidget = new WallhavenSettingsGroup(this._currentSourceRow.id);
            break;
        case Utils.SourceType.REDDIT:
            targetWidget = new RedditSettingsGroup(this._currentSourceRow.id);
            break;
        case Utils.SourceType.GENERIC_JSON:
            targetWidget = new GenericJsonSettingsGroup(this._currentSourceRow.id);
            break;
        case Utils.SourceType.LOCAL_FOLDER:
            targetWidget = new LocalFolderSettingsGroup(this._currentSourceRow.id);
            break;
        case Utils.SourceType.STATIC_URL:
            targetWidget = new UrlSourceSettingsGroup(this._currentSourceRow.id);
            break;
        default:
            targetWidget = null;
            Logger.error('The selected source has no corresponding widget!', this);
            break;
        }
        return targetWidget;
    }

    /**
     * Open the modal window.
     *
     * @returns {Promise<SourceRow>} Returns a promise resolving into the created/edited source row when closed/saved.
     */
    async open(): Promise<SourceRow> {
        const promise = await new Promise<SourceRow>((resolve: (sourceRow: SourceRow) => void, reject: (error: Error) => void) => {
            this.show();

            this._button_add.connect('clicked', () => {
                this.close();
                resolve(this._currentSourceRow);
            });

            this._button_close.connect('clicked', () => {
                this.close();
                resolve(this._currentSourceRow);
            });

            this._button_cancel.connect('clicked', () => {
                this.close();
                this._currentSourceRow.clearConfig();
                reject(new Error('Canceled'));
            });
        });
        return promise;
    }
}

export {SourceConfigModal};
