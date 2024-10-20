import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';
import {Logger} from './../logger.js';

/** How many times the service should be queried at maximum. */
const MAX_SERVICE_RETRIES = 5;

// not exhaustive, only what is needed by this extension
type UnsplashResponse = [
    {
        urls: { raw: 'string' },
        links: { html: 'string' },
        user: {
            name: 'string',
            links: { html: string },
        },
    }
];

/**
 * Adapter for image sources using Unsplash.
 */
class UnsplashAdapter extends BaseAdapter {
    private _sourceUrl = 'https://unsplash.com';

    // default query options
    private _options = {
        'api_key': '',
        'query': '',
        'collections': '',
        'topics': '',
        'username': '',
        'orientation': '',
        'content_filter': '',
    };

    /**
     * Create a new Unsplash adapter.
     *
     * @param {string} id Unique ID
     * @param {string} name Custom name of this adapter
     */
    constructor(id: string, name: string) {
        super({
            defaultName: 'Unsplash',
            id,
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

        let url = `https://api.unsplash.com/photos/random?count=1${optionsString}`;
        url = encodeURI(url);

        Logger.debug(`Unsplash request to: ${url}`, this);

        const message = this._bowl.newGetMessage(url);
        await this._bowl.send_and_receive(message);

        let response_body;
        try {
            const response_body_bytes = await this._bowl.send_and_receive(message);
            response_body = JSON.parse(new TextDecoder().decode(response_body_bytes)) as UnsplashResponse;
        } catch (error) {
            throw new Error(`Could not parse response for ${url}!\n${String(error)}`);
        }

        const imageDownloadURL = response_body[0].urls.raw;
        if (!imageDownloadURL)
            throw new Error('No image link in response.');

        if (this._isImageBlocked(Utils.fileName(imageDownloadURL))) {
            // Abort and try again
            throw new Error('Image blocked');
        }

        const historyEntry = new HistoryEntry(null, this._sourceName, imageDownloadURL);
        historyEntry.source.sourceUrl = this._sourceUrl;
        historyEntry.source.author = response_body[0].user.name;
        historyEntry.source.authorUrl = response_body[0].user.links.html;
        historyEntry.source.imageLinkUrl = response_body[0].links.html;

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
                Logger.warn('Failed getting image.', this);
                Logger.warn(error, this);
                // Do not escalate yet, try again
            }

            // Image blocked, try again
        }

        if (wallpaperResult.length < count) {
            Logger.warn('Returning less images than requested.', this);
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

        if (options.api_key)
            optionsString += `&client_id=${options.api_key}`;

        if (options.username)
            optionsString += `&username=${options.username}`;

        if (options.orientation)
            optionsString += `&orientation=${options.orientation}`;

        if (options.content_filter)
            optionsString += `&content_filter=${options.content_filter}`;

        if (options.collections)
            optionsString += `&collections=${options.collections}`;

        if (options.topics)
            optionsString += `&topics=${options.topics}`;

        if (options.query)
            optionsString += `&query=${options.query}`;

        return optionsString;
    }

    /**
     * Freshly read the user settings options.
     */
    private _readOptionsFromSettings(): void {
        this._options.api_key = this._settings.getString('api-key');
        this._options.username = this._settings.getString('username');
        this._options.query = this._settings.getString('query');
        this._options.collections = this._settings.getString('collections');
        this._options.topics = this._settings.getString('topics');
        this._options.orientation = this._settings.getString('orientation');
        this._options.content_filter = this._settings.getString('content-filter');
    }
}

export {
    UnsplashAdapter
};
