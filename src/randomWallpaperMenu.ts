// These two rules contradict each other in TS and JS mode for @this in function descriptions below.
// @this can be removed in TS but then JS complains about missing @this in documentation.
// Disabling these rules for this specific file for now.
/* eslint-disable jsdoc/check-tag-names */
/* eslint-disable jsdoc/valid-types */

import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as CustomElements from './historyMenuElements.js';
import * as Settings from './settings.js';
import * as Utils from './utils.js';

import {Logger} from './logger.js';
import {WallpaperController} from './wallpaperController.js';
import {HistoryEntry} from './history.js';

/**
 * PanelMenu for this extension.
 */
class RandomWallpaperMenu {
    private _backendConnection = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);
    private _settings = new Settings.Settings();
    private _observedValues: number[] = [];
    private _observedBackgroundValues: number[] = [];

    private _historySection;
    private _panelMenu;
    private _wallpaperController;

    private previewSection = new PopupMenu.PopupMenuSection();
    private previewSeparator = new PopupMenu.PopupSeparatorMenuItem();
    private previewWidget: CustomElements.PreviewWidget;

    /**
     * Create a new PanelMenu.
     *
     * @param {WallpaperController} wallpaperController The wallpaper controller controlling the wallpapers :D
     */
    constructor(wallpaperController: WallpaperController) {
        this._wallpaperController = wallpaperController;

        this._panelMenu = new PanelMenu.Button(0, 'Random wallpaper');

        // PanelMenu Icon
        const statusIcon = new CustomElements.StatusElement();
        this._panelMenu.add_child(statusIcon.icon);
        this._observedValues.push(this._settings.observe('hide-panel-icon', this.updatePanelMenuVisibility.bind(this)));

        // new wallpaper button
        const newWallpaperItem = new CustomElements.NewWallpaperElement();
        this._panelMenu.menu.addMenuItem(newWallpaperItem);

        this._panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Set fixed width so the preview images don't widen the menu
        this._panelMenu.menu.actor.set_width(350);

        // Preview widget showing the current wallpaper
        this._panelMenu.menu.addMenuItem(this.previewSection);
        this.previewWidget = new CustomElements.PreviewWidget(this._panelMenu.menu.actor.width);
        this.previewSection.actor.add_child(this.previewWidget);
        this._panelMenu.menu.addMenuItem(this.previewSeparator);

        // history section
        this._historySection = new CustomElements.HistorySection();
        this._panelMenu.menu.addMenuItem(this._historySection);

        this._panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Temporarily pause timer
        const pauseTimerItem = new PopupMenu.PopupSwitchMenuItem(_('Pause Timer'), false);

        pauseTimerItem.connect('toggled', (_unused, state: boolean) => {
            this._backendConnection.setBoolean('pause-timer', state);
        });

        const autoFetchChangedCallback = (): void => {
            if (this._settings.getBoolean('auto-fetch'))
                pauseTimerItem.show();
            else
                pauseTimerItem.hide();
        };
        this._observedValues.push(this._settings.observe('auto-fetch', autoFetchChangedCallback));
        autoFetchChangedCallback();

        const pauseTimerChangedCallback = (): void => {
            pauseTimerItem.setToggleState(this._backendConnection.getBoolean('pause-timer'));
        };
        this._observedBackgroundValues.push(this._backendConnection.observe('pause-timer', pauseTimerChangedCallback));
        pauseTimerChangedCallback();

        this._panelMenu.menu.addMenuItem(pauseTimerItem);

        // clear history button
        const clearHistoryItem = new PopupMenu.PopupMenuItem(_('Clear History'));
        this._panelMenu.menu.addMenuItem(clearHistoryItem);

        // open wallpaper folder button
        const openFolder = new PopupMenu.PopupMenuItem(_('Open Wallpaper Folder'));
        this._panelMenu.menu.addMenuItem(openFolder);

        // settings button
        const openSettings = new PopupMenu.PopupMenuItem(_('Settings'));
        this._panelMenu.menu.addMenuItem(openSettings);

        // add eventlistener
        this._wallpaperController.registerStartLoadingHook(() => statusIcon.startLoading());
        this._wallpaperController.registerStopLoadingHook(() => statusIcon.stopLoading());
        this._wallpaperController.registerStopLoadingHook(() => this.setHistoryList());

        // new wallpaper event
        newWallpaperItem.connect('activate', () => {
            this._wallpaperController.fetchNewWallpaper()
                .then(() => { /* nothing to do */ })
                .catch(error => {
                    Logger.error(error, this);
                });
        });

        // clear history event
        clearHistoryItem.connect('activate', () => {
            this._wallpaperController.deleteHistory();
        });

        // Open Wallpaper Folder
        openFolder.connect('activate', () => {
            const uri = GLib.filename_to_uri(this._wallpaperController.wallpaperLocation, '');
            if (uri) {
                Utils.execCheck(['xdg-open', uri]).catch(error => {
                    Logger.error(error, this);
                });
            } else {
                Logger.error(`Failed to get URI for set wallpaper location ${this._wallpaperController.wallpaperLocation}`);
            }
        });

        openSettings.connect('activate', () => {
            const extensionObject = Extension.lookupByURL(import.meta.url);
            if (!extensionObject) {
                Logger.error('Own extension object not found!', this);
                throw new Error('Own extension object not found!');
            }

            if (extensionObject instanceof Extension)
                extensionObject.openPreferences();
        });

        this._panelMenu.menu.connect('open-state-changed', (_unused, open) => {
            if (open)
                newWallpaperItem.show();
        });

        this._observedValues.push(this._settings.observe('history', this.setHistoryList.bind(this)));
    }

    /**
     * Initialize remaining PanelMenu bits.
     */
    init(): void {
        this.updatePanelMenuVisibility();
        this.setHistoryList();

        // add to panel
        Main.panel.addToStatusArea('random-wallpaper-menu', this._panelMenu);
    }

    /**
     * Remove the PanelMenu and remnants.
     */
    cleanup(): void {
        this.clearHistoryList();
        this._panelMenu.destroy();

        // remove all signal handlers
        for (const observedValue of this._observedValues)
            this._settings.disconnect(observedValue);
        this._observedValues = [];

        for (const observedValue of this._observedBackgroundValues)
            this._backendConnection.disconnect(observedValue);
        this._observedBackgroundValues = [];
    }

    /**
     * Hide or show the PanelMenu based on user settings.
     */
    updatePanelMenuVisibility(): void {
        if (this._settings.getBoolean('hide-panel-icon'))
            this._panelMenu.hide();
        else
            this._panelMenu.show();
    }

    /**
     * Recreates the history list based on the history.
     */
    setHistoryList(): void {
        this._wallpaperController.update();

        const historyController = this._wallpaperController.getHistoryController();
        const history = historyController.history;

        if (history.length === 0) {
            this.clearHistoryList();
            return;
        }

        /**
         * Function for events that should happen on element leave.
         *
         * @param {HistoryEntry} _entry The left/unfocused history entry
         */
        const onLeave = (_entry: HistoryEntry): void => {
            if (history.length > 0)
                this.previewWidget.preview(history[0].path);

            this._wallpaperController.resetPreview();
        };

        /**
         * Function for events that should happen on element enter.
         *
         * @param {HistoryEntry} entry The hovered/focused history entry
         */
        const onEnter = (entry: HistoryEntry): void => {
            this.previewWidget.preview(entry.path);
            this._wallpaperController.previewWallpaper(entry.id);
        };

        /**
         * Function for events that should happen on element select.
         *
         * @param {HistoryEntry} entry The selected history entry
         */
        const onSelect = (entry: HistoryEntry): void => {
            Logger.debug(`Selected entry from history as wallpaper (source: ${entry.source.source})`, this);
            this._wallpaperController.resetPreview();
            this._wallpaperController.setWallpaper(entry).then(() => {
                this.setHistoryList();
            }).catch(error => {
                Logger.error(error, this);
            });
        };

        this._historySection.updateList(history, onEnter, onLeave, onSelect);

        this.previewWidget.preview(history[0].path);
        this.previewWidget.show();
        this.previewSeparator.show();
    }

    /**
     * Remove the history section
     */
    clearHistoryList(): void {
        this.previewWidget.hide();
        this.previewSeparator.hide();
        this._historySection.clear();
    }
}

export {RandomWallpaperMenu};
