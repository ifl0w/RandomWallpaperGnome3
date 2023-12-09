// These two rules contradict each other in TS and JS mode for @this in function descriptions below.
// @this can be removed in TS but then JS complains about missing @this in documentation.
// Disabling these rules for this specific file for now.
/* eslint-disable jsdoc/check-tag-names */
/* eslint-disable jsdoc/valid-types */

import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as CustomElements from './historyMenuElements.js';
import * as Settings from './settings.js';
import * as Utils from './utils.js';

import {Logger} from './logger.js';
import {WallpaperController} from './wallpaperController.js';
import {Mode} from './manager/wallpaperManager.js';

/**
 * PanelMenu for this extension.
 */
class RandomWallpaperMenu {
    private _backendConnection = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);
    private _savedBackgroundUri: string | null = null;
    private _settings = new Settings.Settings();
    private _observedValues: number[] = [];
    private _observedBackgroundValues: number[] = [];

    private _currentBackgroundSection;
    private _historySection;
    private _panelMenu;
    private _wallpaperController;

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

        // current background section
        this._currentBackgroundSection = new PopupMenu.PopupMenuSection();
        this._panelMenu.menu.addMenuItem(this._currentBackgroundSection);
        this._panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // history section
        this._historySection = new CustomElements.HistorySection();
        this._panelMenu.menu.addMenuItem(this._historySection);

        this._panelMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Temporarily pause timer
        const pauseTimerItem = new PopupMenu.PopupSwitchMenuItem('Pause timer', false);
        pauseTimerItem.sensitive = this._settings.getBoolean('auto-fetch');
        pauseTimerItem.setToggleState(this._backendConnection.getBoolean('pause-timer'));

        pauseTimerItem.connect('toggled', (_, state: boolean) => {
            this._backendConnection.setBoolean('pause-timer', state);
        });

        this._observedValues.push(this._settings.observe('auto-fetch', () => {
            pauseTimerItem.sensitive = this._settings.getBoolean('auto-fetch');
        }));

        this._observedBackgroundValues.push(this._backendConnection.observe('pause-timer', () => {
            pauseTimerItem.setToggleState(this._backendConnection.getBoolean('pause-timer'));
        }));

        this._panelMenu.menu.addMenuItem(pauseTimerItem);

        // clear history button
        const clearHistoryItem = new PopupMenu.PopupMenuItem('Clear History');
        this._panelMenu.menu.addMenuItem(clearHistoryItem);

        // open wallpaper folder button
        const openFolder = new PopupMenu.PopupMenuItem('Open Wallpaper Folder');
        this._panelMenu.menu.addMenuItem(openFolder);

        // settings button
        const openSettings = new PopupMenu.PopupMenuItem('Settings');
        this._panelMenu.menu.addMenuItem(openSettings);

        // add eventlistener
        this._wallpaperController.registerStartLoadingHook(() => statusIcon.startLoading());
        this._wallpaperController.registerStopLoadingHook(() => statusIcon.stopLoading());
        this._wallpaperController.registerStopLoadingHook(() => this.setHistoryList());

        // new wallpaper event
        newWallpaperItem.connect('activate', () => {
            // Make sure no other preview or reset event overwrites our setWallpaper!
            this._wallpaperController.prohibitNewWallpaper = true;
            this._wallpaperController.fetchNewWallpaper().then(() => {
            }).catch(error => {
                Logger.error(error, this);
            }).finally(() => {
                this._wallpaperController.prohibitNewWallpaper = false;
            });
        });

        // clear history event
        clearHistoryItem.connect('activate', () => {
            this._wallpaperController.deleteHistory();
        });

        // Open Wallpaper Folder
        openFolder.connect('activate', () => {
            const uri = GLib.filename_to_uri(this._wallpaperController.wallpaperLocation, '');
            Utils.execCheck(['xdg-open', uri]).catch(error => {
                Logger.error(error, this);
            });
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

        this._panelMenu.menu.connect('open-state-changed', (_, open) => {
            if (open) {
                // Save currently used background so we can reset to this
                // in case only the lock screen was changed while the preview
                // used the normal background
                const backgroundSettings = new Settings.Settings('org.gnome.desktop.background');
                this._savedBackgroundUri = backgroundSettings.getString('picture-uri');

                // Update remaining time label
                newWallpaperItem.show();
            } else {
                // Reset to the saved background image on popup closing
                if (!this._wallpaperController.prohibitNewWallpaper && this._savedBackgroundUri)
                    this._wallpaperController.resetWallpaper(this._savedBackgroundUri);

                this._savedBackgroundUri = null;
            }
        });

        // FIXME?: This triggers by leaving the underlying popupMenu and blocks previewing the items
        // when entering from any side other than another item. (eg. spacer or the sides)
        // this._panelMenu.menu.actor.connect('leave-event', () => {
        //     if (!this._wallpaperController.prohibitNewWallpaper)
        //         this._wallpaperController.resetWallpaper(this._savedBackgroundUri);
        // });

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
     * Recreates the current background section based on the history.
     */
    setCurrentBackgroundElement(): void {
        this._currentBackgroundSection.removeAll();

        const historyController = this._wallpaperController.getHistoryController();
        const history = historyController.history;

        if (history.length > 0) {
            const currentImage = new CustomElements.CurrentImageElement(history[0]);
            this._currentBackgroundSection.addMenuItem(currentImage);
        }
    }

    /**
     * Recreates the history list based on the history.
     */
    setHistoryList(): void {
        this._wallpaperController.update();
        this.setCurrentBackgroundElement();

        const historyController = this._wallpaperController.getHistoryController();
        const history = historyController.history;

        if (history.length <= 1) {
            this.clearHistoryList();
            return;
        }

        /**
         * Function for events that should happen on element leave.
         *
         * @param {CustomElements.HistoryElement} unusedActor The activating panel item
         * @this RandomWallpaperMenu
         */
        function onLeave(this: RandomWallpaperMenu, unusedActor: CustomElements.HistoryElement): void {
            if (!this._wallpaperController.prohibitNewWallpaper && this._savedBackgroundUri)
                this._wallpaperController.resetWallpaper(this._savedBackgroundUri);
        }

        /**
         * Function for events that should happen on element enter.
         *
         * @param {CustomElements.HistoryElement} actor The activating panel item
         * @this RandomWallpaperMenu
         */
        function onEnter(this: RandomWallpaperMenu, actor: CustomElements.HistoryElement): void {
            if (!this._wallpaperController.prohibitNewWallpaper)
                this._wallpaperController.previewWallpaper(actor.historyEntry.id);
        }

        /**
         * Function for events that should happen on element select.
         *
         * @param {CustomElements.HistoryElement} actor The activating panel item
         * @this RandomWallpaperMenu
         */
        function onSelect(this: RandomWallpaperMenu, actor: CustomElements.HistoryElement): void {
            // Make sure no other preview or reset event overwrites our setWallpaper!
            this._wallpaperController.prohibitNewWallpaper = true;

            this._wallpaperController.setWallpaper(actor.historyEntry.id).then(() => {
                this._wallpaperController.prohibitNewWallpaper = false;

                if (this._settings.getInt('change-type') as Mode === Mode.LOCKSCREEN && this._savedBackgroundUri) {
                    // Reset background after previewing the lock screen options
                    this._wallpaperController.resetWallpaper(this._savedBackgroundUri);
                } else {
                    // Update saved background with newly set background image
                    // so we don't revert to an older state when closing the menu
                    const backgroundSettings = new Settings.Settings('org.gnome.desktop.background');
                    this._savedBackgroundUri = backgroundSettings.getString('picture-uri');
                }
            }).catch(error => {
                this._wallpaperController.prohibitNewWallpaper = false;
                Logger.error(error, this);
            });
        }

        this._historySection.updateList(history, onEnter.bind(this), onLeave.bind(this), onSelect.bind(this));
    }

    /**
     * Remove the history section
     */
    clearHistoryList(): void {
        this._historySection.clear();
    }
}

export {RandomWallpaperMenu};
