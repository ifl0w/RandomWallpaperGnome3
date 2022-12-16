import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';

import * as Main from '@gi/ui/main';
import * as PanelMenu from '@gi/ui/panelMenu';
import * as PopupMenu from '@gi/ui/popupMenu';
import * as ExtensionUtils from '@gi/misc/extensionUtils';

import * as CustomElements from './historyMenuElements.js';
import * as Settings from './settings.js';
import * as Utils from './utils.js';

import {Logger} from './logger.js';
import {WallpaperController} from './wallpaperController.js';

const Self = ExtensionUtils.getCurrentExtension();

class RandomWallpaperMenu {
    private _logger = new Logger('RWG3', 'RandomWallpaperEntry');
    private _backendConnection = new Settings.Settings(Settings.RWG_SETTINGS_SCHEMA_BACKEND_CONNECTION);
    private _savedBackgroundUri: string | null = null;
    private _settings = new Settings.Settings();

    private _currentBackgroundSection;
    private _hidePanelIconHandler;
    private _historySection;
    private _panelMenu;
    private _wallpaperController;

    constructor(wallpaperController: WallpaperController) {
        this._wallpaperController = wallpaperController;

        this._panelMenu = new PanelMenu.Button(0, 'Random wallpaper');

        // PanelMenu Icon
        const statusIcon = new CustomElements.StatusElement();
        this._panelMenu.add_child(statusIcon.icon);
        this._hidePanelIconHandler = this._settings.observe('hide-panel-icon', this.updatePanelMenuVisibility.bind(this));

        // new wallpaper button
        const newWallpaperItem = new CustomElements.NewWallpaperElement({});
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

        this._settings.observe('auto-fetch', () => {
            pauseTimerItem.sensitive = this._settings.getBoolean('auto-fetch');
        });

        this._backendConnection.observe('pause-timer', () => {
            pauseTimerItem.setToggleState(this._backendConnection.getBoolean('pause-timer'));
        });

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
                this._wallpaperController.prohibitNewWallpaper = false;
            }).catch(error => {
                this._wallpaperController.prohibitNewWallpaper = false;
                this._logger.error(error);
            });
        });

        // clear history event
        clearHistoryItem.connect('activate', () => {
            this._wallpaperController.deleteHistory();
        });

        // Open Wallpaper Folder
        openFolder.connect('activate', () => {
            const uri = GLib.filename_to_uri(this._wallpaperController.wallpaperLocation, '');
            Utils.execCheck(['xdg-open', uri]).catch(this._logger.error);
        });

        openSettings.connect('activate', () => {
            // FIXME: Unhandled promise rejection. To suppress this warning, add an error handler to your promise chain with .catch() or a try-catch block around your await expression.
            Gio.DBus.session.call(
                'org.gnome.Shell.Extensions',
                '/org/gnome/Shell/Extensions',
                'org.gnome.Shell.Extensions',
                'OpenExtensionPrefs',
                new GLib.Variant('(ssa{sv})', [Self.uuid, '', {}]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null);
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

        this._settings.observe('history', this.setHistoryList.bind(this));
    }

    init() {
        this.updatePanelMenuVisibility();
        this.setHistoryList();

        // add to panel
        Main.panel.addToStatusArea('random-wallpaper-menu', this._panelMenu);
    }

    cleanup() {
        this.clearHistoryList();
        this._panelMenu.destroy();

        // remove all signal handlers
        if (this._hidePanelIconHandler !== null)
            this._settings.disconnect(this._hidePanelIconHandler);
    }

    updatePanelMenuVisibility() {
        if (this._settings.getBoolean('hide-panel-icon'))
            this._panelMenu.hide();
        else
            this._panelMenu.show();
    }

    setCurrentBackgroundElement() {
        this._currentBackgroundSection.removeAll();

        const historyController = this._wallpaperController.getHistoryController();
        const history = historyController.history;

        if (history.length > 0) {
            const currentImage = new CustomElements.CurrentImageElement(undefined, history[0]);
            this._currentBackgroundSection.addMenuItem(currentImage);
        }
    }

    setHistoryList() {
        this._wallpaperController.update();
        this.setCurrentBackgroundElement();

        const historyController = this._wallpaperController.getHistoryController();
        const history = historyController.history;

        if (history.length <= 1) {
            this.clearHistoryList();
            return;
        }

        /**
         * @this {RandomWallpaperMenu} RandomWallpaperMenu
         * @param {InstanceType<typeof CustomElements.HistoryElement>} unusedActor The activating panel item
         */
        function onLeave(this: RandomWallpaperMenu, unusedActor: InstanceType<typeof CustomElements.HistoryElement>) {
            if (!this._wallpaperController.prohibitNewWallpaper && this._savedBackgroundUri)
                this._wallpaperController.resetWallpaper(this._savedBackgroundUri);
        }

        /**
         * @this {RandomWallpaperMenu} RandomWallpaperMenu
         * @param {InstanceType<typeof CustomElements.HistoryElement>} actor The activating panel item
         */
        function onEnter(this: RandomWallpaperMenu, actor: InstanceType<typeof CustomElements.HistoryElement>) {
            if (!this._wallpaperController.prohibitNewWallpaper)
                this._wallpaperController.previewWallpaper(actor.historyEntry.id);
        }

        /**
         * @this {RandomWallpaperMenu} RandomWallpaperMenu
         * @param {InstanceType<typeof CustomElements.HistoryElement>} actor The activating panel item
         */
        function onSelect(this: RandomWallpaperMenu, actor: InstanceType<typeof CustomElements.HistoryElement>) {
            // Make sure no other preview or reset event overwrites our setWallpaper!
            this._wallpaperController.prohibitNewWallpaper = true;

            this._wallpaperController.setWallpaper(actor.historyEntry.id).then(() => {
                this._wallpaperController.prohibitNewWallpaper = false;

                if (this._settings.getEnum('change-type') === 1 && this._savedBackgroundUri) {
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
                this._logger.error(error);
            });
        }

        this._historySection.updateList(history, onEnter.bind(this), onLeave.bind(this), onSelect.bind(this));
    }

    clearHistoryList() {
        this._historySection.clear();
    }
}

export {RandomWallpaperMenu};
