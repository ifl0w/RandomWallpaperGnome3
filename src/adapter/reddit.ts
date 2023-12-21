import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';
import {Logger} from '../logger.js';

interface RedditResponse {
    data: {
        children: RedditSubmission[],
    }
}

interface RedditSubmission {
    data: {
        post_hint: string,
        over_18: boolean,
        subreddit_name_prefixed: string,
        permalink: string,
        preview: {
            images: {
                source: {
                    width: number,
                    height: number,
                    url: string,
                }
            }[]
        }
    }
}

/**
 * Adapter for Reddit image sources.
 */
class RedditAdapter extends BaseAdapter {
    /**
     * Create a new Reddit adapter.
     *
     * @param {string} id Unique ID
     * @param {string} name Custom name of this adapter
     */
    constructor(id: string, name: string) {
        super({
            defaultName: 'Reddit',
            id,
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_REDDIT,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/reddit/${id}/`,
        });
    }

    /**
     * Replace an HTML &amp with an actual & symbol.
     *
     * @param {string} string String to replace in
     * @returns {string} String with replaced symbols
     */
    private _ampDecode(string: string): string {
        return string.replace(/&amp;/g, '&');
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
        const subreddits = this._settings.getString('subreddits').split(',').map(s => s.trim()).join('+');
        const require_sfw = this._settings.getBoolean('allow-sfw');

        const url = encodeURI(`https://www.reddit.com/r/${subreddits}.json`);
        const message = this._bowl.newGetMessage(url);

        let response_body;
        try {
            const response_body_bytes = await this._bowl.send_and_receive(message);
            response_body = JSON.parse(new TextDecoder().decode(response_body_bytes)) as unknown;
        } catch (error) {
            Logger.error(`Could not parse response for ${url}!\n${String(error)}`, this);
            throw wallpaperResult;
        }

        if (!this._isRedditResponse(response_body)) {
            Logger.error('Unexpected response', this);
            throw wallpaperResult;
        }

        const filteredSubmissions = response_body.data.children.filter(child => {
            if (child.data.post_hint !== 'image')
                return false;
            if (require_sfw)
                return child.data.over_18 === false;

            const minWidth = this._settings.getInt('min-width');
            const minHeight = this._settings.getInt('min-height');
            if (child.data.preview.images[0].source.width < minWidth)
                return false;
            if (child.data.preview.images[0].source.height < minHeight)
                return false;

            const imageRatio1 = this._settings.getInt('image-ratio1');
            const imageRatio2 = this._settings.getInt('image-ratio2');
            if (child.data.preview.images[0].source.width / imageRatio1 * imageRatio2 < child.data.preview.images[0].source.height)
                return false;
            return true;
        });

        if (filteredSubmissions.length === 0) {
            Logger.error('No suitable submissions found!', this);
            throw wallpaperResult;
        }

        for (let i = 0; i < filteredSubmissions.length && wallpaperResult.length < count; i++) {
            const random = Utils.getRandomNumber(filteredSubmissions.length);
            const submission = filteredSubmissions[random].data;
            const imageDownloadUrl = this._ampDecode(submission.preview.images[0].source.url);

            if (this._isImageBlocked(Utils.fileName(imageDownloadUrl)))
                continue;

            const historyEntry = new HistoryEntry(null, this._sourceName, imageDownloadUrl);
            historyEntry.source.sourceUrl = `https://www.reddit.com/${submission.subreddit_name_prefixed}`;
            historyEntry.source.imageLinkUrl = `https://www.reddit.com/${submission.permalink}`;

            if (!this._includesWallpaper(wallpaperResult, historyEntry.source.imageDownloadUrl))
                wallpaperResult.push(historyEntry);
        }

        if (wallpaperResult.length < count) {
            Logger.warn('Returning less images than requested.', this);
            throw wallpaperResult;
        }

        return wallpaperResult;
    }

    /**
     * Check if the response is expected to be a response by Reddit.
     *
     * Primarily in use for typescript typing.
     *
     * @param {unknown} object Unknown object to narrow down
     * @returns {boolean} Whether the response is from Reddit
     */
    private _isRedditResponse(object: unknown): object is RedditResponse {
        if (typeof object === 'object' &&
            object &&
            'data' in object &&
            typeof object.data === 'object' &&
            object.data &&
            'children' in object.data &&
            Array.isArray(object.data.children)
        )
            return true;

        return false;
    }
}

export {RedditAdapter};
