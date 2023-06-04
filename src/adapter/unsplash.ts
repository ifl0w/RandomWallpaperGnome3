import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';

/** How many times the service should be queried at maximum. */
const MAX_SERVICE_RETRIES = 5;

/**
 * Adapter for image sources using Unsplash.
 */
class UnsplashAdapter extends BaseAdapter {
    private _sourceUrl = 'https://source.unsplash.com';

    // default query options
    private _options = {
        'query': '',
        'w': 1920,
        'h': 1080,
        'featured': false,
        'constraintType': 0,
        'constraintValue': '',
    };

    /**
     * Create a new Unsplash adapter.
     *
     * @param {string} id Unique ID
     * @param {string} name Custom name of this adapter
     */
    constructor(id: string | null, name: string | null) {
        super({
            defaultName: 'Unsplash',
            id: id ?? '-1',
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/unsplash/${id ?? '-1'}/`,
        });
    }

    /**
     * Retrieves a new URL for an image and crafts new HistoryEntry.
     *
     * @returns {HistoryEntry} Crafted HistoryEntry
     * @throws {Error} Error with description
     */
    private async _getHistoryEntry(): Promise<HistoryEntry> {
        this._readOptionsFromSettings();
        const optionsString = this._generateOptionsString();

        let url = `https://source.unsplash.com${optionsString}`;
        url = encodeURI(url);

        this._logger.debug(`Unsplash request to: ${url}`);

        const message = this._bowl.newGetMessage(url);

        // unsplash redirects to actual file; we only want the file location
        message.set_flags(this._bowl.MessageFlags.NO_REDIRECT);

        await this._bowl.send_and_receive(message);

        // expecting redirect
        if (message.status_code !== 302)
            throw new Error('Unexpected response status code (expected 302)');

        const imageLinkUrl = message.response_headers.get_one('Location');
        if (!imageLinkUrl)
            throw new Error('No image link in response.');


        if (this._isImageBlocked(Utils.fileName(imageLinkUrl))) {
            // Abort and try again
            throw new Error('Image blocked');
        }

        const historyEntry = new HistoryEntry(null, this._sourceName, imageLinkUrl);
        historyEntry.source.sourceUrl = this._sourceUrl;
        historyEntry.source.imageLinkUrl = imageLinkUrl;

        return historyEntry;
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
    async requestRandomImage(count: number): Promise<HistoryEntry[]> {
        const wallpaperResult: HistoryEntry[] = [];

        for (let i = 0; i < MAX_SERVICE_RETRIES + count && wallpaperResult.length < count; i++) {
            try {
                // This should run sequentially
                // eslint-disable-next-line no-await-in-loop
                const historyEntry = await this._getHistoryEntry();

                if (!this._includesWallpaper(wallpaperResult, historyEntry.source.imageDownloadUrl))
                    wallpaperResult.push(historyEntry);
            } catch (error) {
                this._logger.warn('Failed getting image.');
                this._logger.warn(error);
                // Do not escalate yet, try again
            }

            // Image blocked, try again
        }

        if (wallpaperResult.length < count) {
            this._logger.warn('Returning less images than requested.');
            throw wallpaperResult;
        }

        return wallpaperResult;
    }

    /**
     * Create an option string based on user settings.
     *
     * Does not refresh settings itself.
     *
     * @returns {string} Options string
     */
    private _generateOptionsString(): string {
        const options = this._options;
        let optionsString = '';

        switch (options.constraintType) {
        case 1:
            optionsString = `/user/${options.constraintValue}/`;
            break;
        case 2:
            optionsString = `/user/${options.constraintValue}/likes/`;
            break;
        case 3:
            optionsString = `/collection/${options.constraintValue}/`;
            break;
        default:
            if (options.featured)
                optionsString = '/featured/';
            else
                optionsString = '/random/';
        }

        if (options.w && options.h)
            optionsString += `${options.w}x${options.h}`;


        if (options.query) {
            const q = options.query.replace(/\W/, ',');
            optionsString += `?${q}`;
        }

        return optionsString;
    }

    /**
     * Freshly read the user settings options.
     */
    private _readOptionsFromSettings(): void {
        this._options.w = this._settings.getInt('image-width');
        this._options.h = this._settings.getInt('image-height');

        this._options.constraintType = this._settings.getEnum('constraint-type');
        this._options.constraintValue = this._settings.getString('constraint-value');

        const keywords = this._settings.getString('keyword').split(',');
        if (keywords.length > 0) {
            const randomKeyword = keywords[Utils.getRandomNumber(keywords.length)];
            this._options.query = randomKeyword.trim();
        }

        this._options.featured = this._settings.getBoolean('featured-only');
    }
}

export {UnsplashAdapter};
