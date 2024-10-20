import {notify} from 'resource:///org/gnome/shell/ui/main.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

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
        const infoString = `${_('Source')}: ${historyEntries.map(h => `${h.source.source ?? _('Unknown Source')}`).join(', ')}`;
        const message = `${_('A new wallpaper was set!')}\n${infoString}`;
        notify(_('New Wallpaper'), message);
    }

    /**
     * Show an error notification for failed wallpaper downloads.
     *
     * @param {unknown} error The error that was thrown when fetching a new wallpaper
     */
    static fetchWallpaperFailed(error: unknown): void {
        let errorMessage = String(error);

        if (error instanceof Error)
            errorMessage = error.message;

        notify(`RandomWallpaperGnome3: ${_('Wallpaper Download Failed!')}`, errorMessage);
    }
}

export {Notification};
