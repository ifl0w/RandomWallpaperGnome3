import * as ByteArray from '@gi-types/gjs-environment/legacyModules/byteArray';

import * as JSONPath from './../jsonPath.js';
import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';
import {SoupBowl} from './../soupBowl.js';

class GenericJsonAdapter extends BaseAdapter {
    private _bowl = new SoupBowl();

    constructor(id: string, name: string, wallpaperLocation: string) {
        super({
            defaultName: 'Generic JSON Source',
            id,
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/genericJSON/${id}/`,
            wallpaperLocation,
        });
    }

    private async _getHistoryEntry(count: number) {
        const wallpaperResult: HistoryEntry[] = [];

        let url = this._settings.getString('request-url');
        url = encodeURI(url);

        const message = this._bowl.newGetMessage(url);
        if (message === null)
            throw new Error('Could not create request.');

        const response_body_bytes = await this._bowl.send_and_receive(message);
        if (!response_body_bytes)
            throw new Error('Error fetching response.');

        const response_body = JSON.parse(ByteArray.toString(response_body_bytes));
        const imageJSONPath = this._settings.getString('image-path');
        const postJSONPath = this._settings.getString('post-path');
        const domainUrl = this._settings.getString('domain');
        const authorNameJSONPath = this._settings.getString('author-name-path');
        const authorUrlJSONPath = this._settings.getString('author-url-path');

        for (let i = 0; i < 5 && wallpaperResult.length < count; i++) {
            const returnObject = JSONPath.getTarget(response_body, imageJSONPath);
            if (!returnObject || (typeof returnObject.Object !== 'string' && typeof returnObject.Object !== 'number') || returnObject.Object === '')
                throw new Error('Unexpected json member found');

            const imageDownloadUrl = this._settings.getString('image-prefix') + String(returnObject.Object);
            const imageBlocked = this._isImageBlocked(Utils.fileName(imageDownloadUrl));

            // Don't retry without @random present in JSONPath
            if (imageBlocked && !imageJSONPath.includes('@random')) {
                // Abort and try again
                return null;
            }

            if (imageBlocked)
                continue;

            // '@random' would yield different results so lets make sure the values stay
            // the same as long as the path is identical
            const samePath = imageJSONPath.substring(0, Utils.findFirstDifference(imageJSONPath, postJSONPath));

            // count occurrences of '@random' to slice the array later
            // https://stackoverflow.com/a/4009768
            const occurrences = (samePath.match(/@random/g) || []).length;
            const slicedRandomNumbers = returnObject?.RandomNumbers?.slice(0, occurrences);

            // A bit cumbersome to handle "unknown" in the following parts:
            // https://github.com/microsoft/TypeScript/issues/27706

            let postUrl: string;
            const postUrlObject = JSONPath.getTarget(response_body, postJSONPath, slicedRandomNumbers ? [...slicedRandomNumbers] : undefined, false)?.Object;
            if (typeof postUrlObject === 'string' || typeof postUrlObject === 'number')
                postUrl = this._settings.getString('post-prefix') + String(postUrlObject);
            else
                postUrl = '';

            let authorName: string | null = null;
            const authorNameObject = JSONPath.getTarget(response_body, authorNameJSONPath, slicedRandomNumbers ? [...slicedRandomNumbers] : undefined, false)?.Object;
            if (typeof authorNameObject === 'string' && authorNameObject !== '')
                authorName = authorNameObject;

            let authorUrl: string;
            const authorUrlObject = JSONPath.getTarget(response_body, authorUrlJSONPath, slicedRandomNumbers ? [...slicedRandomNumbers] : undefined, false)?.Object;
            if (typeof authorUrlObject === 'string' || typeof authorUrlObject === 'number')
                authorUrl = this._settings.getString('author-url-prefix') + String(authorUrlObject);
            else
                authorUrl = '';

            const historyEntry = new HistoryEntry(authorName, this._sourceName, imageDownloadUrl);

            if (authorUrl !== '')
                historyEntry.source.authorUrl = authorUrl;

            if (postUrl !== '')
                historyEntry.source.imageLinkUrl = postUrl;

            if (domainUrl !== '')
                historyEntry.source.sourceUrl = domainUrl;

            if (!this._includesWallpaper(wallpaperResult, historyEntry.source.imageDownloadUrl))
                wallpaperResult.push(historyEntry);
        }

        if (wallpaperResult.length === 0)
            throw new Error('Only blocked images found.');

        return wallpaperResult;
    }

    async requestRandomImage(count: number) {
        const wallpaperResult: HistoryEntry[] = [];

        for (let i = 0; i < 5 && wallpaperResult.length < count; i++) {
            try {
                // This should run sequentially
                // eslint-disable-next-line no-await-in-loop
                const historyArray = await this._getHistoryEntry(count);

                if (historyArray) {
                    historyArray.forEach(element => {
                        if (!this._includesWallpaper(wallpaperResult, element.source.imageDownloadUrl))
                            wallpaperResult.push(element);
                    });
                }
            } catch (error) {
                this.logger.warn(`Failed getting image: ${error}`);
                // Do not escalate yet, try again
            }

            // Image blocked, try again
        }

        if (wallpaperResult.length === 0)
            throw new Error('Only blocked images found.');

        return wallpaperResult;
    }
}

export {GenericJsonAdapter};