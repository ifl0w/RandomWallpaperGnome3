import Gio from 'gi://Gio';

import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';

interface QueryOptions {
    q: string,
    purity: string,
    sorting: string,
    categories: string,
    // resolutions: string[],
    colors: string,
    atleast: string,
    ratios: string[],
    // order: string,
    // topRange: string,
}

interface WallhavenSearchResponse {
    data: {
        path:  string,
        url: string,
    }[]
}

/**
 * Adapter for Wallhaven image sources.
 */
class WallhavenAdapter extends BaseAdapter {
    private _options: QueryOptions = {
        q: '',
        purity: '110', // SFW, sketchy
        sorting: 'random',
        categories: '111', // General, Anime, People
        atleast: '1920x1080',
        ratios: ['16x9'],
        colors: '',
    };

    /**
     * Create a new wallhaven adapter.
     *
     * @param {string} id Unique ID
     * @param {string} name Custom name of this adapter
     */
    constructor(id: string, name: string) {
        super({
            id,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/wallhaven/${id}/`,
            name,
            defaultName: 'Wallhaven',
        });
    }

    /**
     * Retrieves new URLs for images and crafts new HistoryEntries.
     *
     * @param {number} count Number of requested wallpaper
     * @returns {HistoryEntry[]} Array of crafted HistoryEntries
     * @throws {HistoryEntry[]} Array of crafted historyEntries, can be empty
     */
    async requestRandomImage(count: number): Promise<HistoryEntry[]> {
        const wallpaperResult: HistoryEntry[] = [];

        this._readOptionsFromSettings();
        const optionsString = this._generateOptionsString(this._options);

        const url = `https://wallhaven.cc/api/v1/search?${encodeURI(optionsString)}`;
        const message = this._bowl.newGetMessage(url);

        const apiKey = this._settings.getString('api-key');
        if (apiKey !== '')
            message.requestHeaders.append('X-API-Key', apiKey);

        this._logger.debug(`Search URL: ${url}`);

        let wallhavenResponse;
        try {
            const response_body_bytes = await this._bowl.send_and_receive(message);
            wallhavenResponse = JSON.parse(new TextDecoder().decode(response_body_bytes)) as unknown;
        } catch (error) {
            this._logger.error(error);
            throw wallpaperResult;
        }

        if (!this._isWallhavenResponse(wallhavenResponse)) {
            this._logger.error('Unexpected response');
            throw wallpaperResult;
        }

        const response = wallhavenResponse.data;
        if (!response || response.length === 0) {
            this._logger.error('Empty response');
            throw wallpaperResult;
        }

        for (let i = 0; i < response.length && wallpaperResult.length < count; i++) {
            const entry = response[i];
            const siteURL = entry.url;
            const downloadURL = entry.path;

            if (this._isImageBlocked(Utils.fileName(downloadURL)))
                continue;

            const historyEntry = new HistoryEntry(null, this._sourceName, downloadURL);
            historyEntry.source.sourceUrl = 'https://wallhaven.cc/';
            historyEntry.source.imageLinkUrl = siteURL;

            if (!this._includesWallpaper(wallpaperResult, historyEntry.source.imageDownloadUrl))
                wallpaperResult.push(historyEntry);
        }

        if (wallpaperResult.length < count) {
            this._logger.warn('Returning less images than requested.');
            throw wallpaperResult;
        }

        return wallpaperResult;
    }

    /**
     * Fetches an image according to a given HistoryEntry.
     *
     * This implementation requests the image in HistoryEntry.source.imageDownloadUrl
     * using Soup and saves it to HistoryEntry.path while setting the X-API-Key header.
     *
     * @param {HistoryEntry} historyEntry The historyEntry to fetch
     * @returns {Promise<HistoryEntry>} unaltered HistoryEntry
     */
    async fetchFile(historyEntry: HistoryEntry): Promise<HistoryEntry> {
        const file = Gio.file_new_for_path(historyEntry.path);
        const fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // craft new message from details
        const request = this._bowl.newGetMessage(historyEntry.source.imageDownloadUrl);

        const apiKey = this._settings.getString('api-key');
        if (apiKey !== '')
            request.requestHeaders.append('X-API-Key', apiKey);

        // start the download
        const response_data_bytes = await this._bowl.send_and_receive(request);
        if (!response_data_bytes) {
            fstream.close(null);
            throw new Error('Not a valid image response');
        }

        fstream.write(response_data_bytes, null);
        fstream.close(null);

        return historyEntry;
    }

    /**
     * Create an option string based on user settings.
     *
     * Does not refresh settings itself.
     *
     * @param {QueryOptions} options Options to check
     * @returns {string} Options string
     */
    private _generateOptionsString<T extends QueryOptions>(options: T): string {
        let optionsString = '';

        for (const key in options) {
            if (options.hasOwnProperty(key)) {
                if (Array.isArray(options[key]))
                    optionsString += `${key}=${(options[key] as Array<string>).join()}&`;
                else if (typeof options[key] === 'string' && options[key] !== '')
                    optionsString += `${key}=${options[key] as string}&`;
            }
        }

        return optionsString;
    }

    /**
     * Check if the response is expected to be a response by Wallhaven.
     *
     * Primarily in use for typescript typing.
     *
     * @param {unknown} object Unknown object to narrow down
     * @returns {boolean} Wether the response is from Reddit
     */
    private _isWallhavenResponse(object: unknown): object is WallhavenSearchResponse {
        if (typeof object === 'object' &&
            object &&
            'data' in object &&
            Array.isArray(object.data)
        )
            return true;

        return false;
    }

    /**
     * Freshly read the user settings options.
     */
    private _readOptionsFromSettings(): void {
        const keywords = this._settings.getString('keyword').split(',');
        if (keywords.length > 0) {
            const randomKeyword = keywords[Utils.getRandomNumber(keywords.length)];
            this._options.q = randomKeyword.trim();
        }

        this._options.atleast = this._settings.getString('minimal-resolution');
        this._options.ratios = this._settings.getString('aspect-ratios').split(',');
        this._options.ratios = this._options.ratios.map(elem => {
            return elem.trim();
        });

        const categories = [];
        categories.push(Number(this._settings.getBoolean('category-general')));
        categories.push(Number(this._settings.getBoolean('category-anime')));
        categories.push(Number(this._settings.getBoolean('category-people')));
        this._options.categories = categories.join('');

        const purity = [];
        purity.push(Number(this._settings.getBoolean('allow-sfw')));
        purity.push(Number(this._settings.getBoolean('allow-sketchy')));
        purity.push(Number(this._settings.getBoolean('allow-nsfw')));
        this._options.purity = purity.join('');

        this._options.colors = this._settings.getString('color');
    }
}

export {WallhavenAdapter};
