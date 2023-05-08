import * as SettingsModule from './../settings.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';
import {Logger} from './../logger.js';

/**
 * Adapter for using a single static URL as an image source.
 */
class UrlSourceAdapter extends BaseAdapter {
    /**
     * Create a new static url adapter.
     *
     * @param {string} id Unique ID
     * @param {string} name Custom name of this adapter
     */
    constructor(id: string, name: string) {
        super({
            defaultName: 'Static URL',
            id,
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/urlSource/${id}/`,
        });
    }

    /**
     * Retrieves new URLs for images and crafts new HistoryEntries.
     *
     * Can internally query the request URL multiple times because only one image will be reported back.
     *
     * @param {number} count Number of requested wallpaper
     * @returns {HistoryEntry[]} Array of crafted HistoryEntries
     * @throws {HistoryEntry[]} Array of crafted historyEntries, can be empty
     */
    requestRandomImage(count: number): Promise<HistoryEntry[]> {
        const wallpaperResult: HistoryEntry[] = [];

        let requestedEntries = 1;
        if (this._settings.getBoolean('different-images'))
            requestedEntries = count;

        const imageDownloadUrl = this._settings.getString('image-url');
        let authorName: string | null = this._settings.getString('author-name');
        const authorUrl = this._settings.getString('author-url');
        const domainUrl = this._settings.getString('domain');
        const postUrl = this._settings.getString('domain');

        if (imageDownloadUrl === '') {
            Logger.error('Missing download url', this);
            throw wallpaperResult;
        }

        if (authorName === '')
            authorName = null;

        for (let i = 0; i < requestedEntries; i++) {
            const historyEntry = new HistoryEntry(authorName, this._sourceName, imageDownloadUrl);

            if (authorUrl !== '')
                historyEntry.source.authorUrl = authorUrl;

            if (postUrl !== '')
                historyEntry.source.imageLinkUrl = postUrl;

            if (domainUrl !== '')
                historyEntry.source.sourceUrl = domainUrl;

            // overwrite historyEntry.id because the name will be the same and the timestamp might be too.
            // historyEntry.name can't be null here because we created the entry with the constructor.
            historyEntry.id = `${historyEntry.timestamp}_${i}_${historyEntry.name!}`;

            wallpaperResult.push(historyEntry);
        }

        return Promise.resolve(wallpaperResult);
    }
}

export {UrlSourceAdapter};
