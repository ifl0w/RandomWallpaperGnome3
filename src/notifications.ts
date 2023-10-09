const Main = imports.ui.main;

import {HistoryEntry} from './history.js';

/**
 * A convenience class for presenting notifications to the user.
 */
class Notification {
    /**
     * Show a notification for the newly set wallpapers.
     *
     * @param {HistoryEntry[]} historyEntries The history elements representing the new wallpapers
     */
    static newWallpaper(historyEntries: HistoryEntry[]): void {
        const infoString = `Source: ${historyEntries.map(h => `${h.source.source ?? 'Unknown Source'}`).join(', ')}`;
        const message = `A new wallpaper was set!\n${infoString}`;
        Main.notify('New Wallpaper', message);
    }
}

export {Notification};

