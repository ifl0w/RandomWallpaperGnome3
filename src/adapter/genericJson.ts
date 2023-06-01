import * as JSONPath from './../jsonPath.js';
import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';

/** How many times the service should be queried at maximum. */
const MAX_SERVICE_RETRIES = 5;
/** How many times we should try to get a new image from an array.
 *  No new request are being made. */
const MAX_ARRAY_RETRIES = 5;

class GenericJsonAdapter extends BaseAdapter {
    constructor(id: string, name: string) {
        super({
            defaultName: 'Generic JSON Source',
            id,
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_GENERIC_JSON,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/genericJSON/${id}/`,
        });
    }

    private async _getHistoryEntry(count: number): Promise<HistoryEntry[]> {
        const wallpaperResult: HistoryEntry[] = [];

        let url = this._settings.getString('request-url');
        url = encodeURI(url);

        const message = this._bowl.newGetMessage(url);
        if (message === null) {
            this._logger.error('Could not create request.');
            throw wallpaperResult;
        }

        let response_body;
        try {
            const response_body_bytes = await this._bowl.send_and_receive(message);
            response_body = JSON.parse(new TextDecoder().decode(response_body_bytes)) as unknown;
        } catch (error) {
            this._logger.error(error);
            throw wallpaperResult;
        }

        const imageJSONPath = this._settings.getString('image-path');
        const postJSONPath = this._settings.getString('post-path');
        const domainUrl = this._settings.getString('domain');
        const authorNameJSONPath = this._settings.getString('author-name-path');
        const authorUrlJSONPath = this._settings.getString('author-url-path');

        for (let i = 0; i < MAX_ARRAY_RETRIES + count && wallpaperResult.length < count; i++) {
            const [returnObject, resolvedPath] = JSONPath.getTarget(response_body, imageJSONPath);
            if (!returnObject || (typeof returnObject !== 'string' && typeof returnObject !== 'number') || returnObject === '') {
                this._logger.error('Unexpected json member found');
                break;
            }

            const imageDownloadUrl = this._settings.getString('image-prefix') + String(returnObject);
            const imageBlocked = this._isImageBlocked(Utils.fileName(imageDownloadUrl));

            // Don't retry without @random present in JSONPath
            if (imageBlocked && !imageJSONPath.includes('@random')) {
                // Abort and try again
                break;
            }

            if (imageBlocked)
                continue;

            // A bit cumbersome to handle "unknown" in the following parts:
            // https://github.com/microsoft/TypeScript/issues/27706

            let postUrl: string;
            const postUrlObject = JSONPath.getTarget(response_body, JSONPath.replaceRandomInPath(postJSONPath, resolvedPath))[0];
            if (typeof postUrlObject === 'string' || typeof postUrlObject === 'number')
                postUrl = this._settings.getString('post-prefix') + String(postUrlObject);
            else
                postUrl = '';

            let authorName: string | null = null;
            const authorNameObject = JSONPath.getTarget(response_body, JSONPath.replaceRandomInPath(authorNameJSONPath, resolvedPath))[0];
            if (typeof authorNameObject === 'string' && authorNameObject !== '')
                authorName = authorNameObject;

            let authorUrl: string;
            const authorUrlObject = JSONPath.getTarget(response_body, JSONPath.replaceRandomInPath(authorUrlJSONPath, resolvedPath))[0];
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

        if (wallpaperResult.length < count) {
            this._logger.warn('Returning less images than requested.');
            throw wallpaperResult;
        }

        return wallpaperResult;
    }

    async requestRandomImage(count: number): Promise<HistoryEntry[]> {
        const wallpaperResult: HistoryEntry[] = [];

        for (let i = 0; i < MAX_SERVICE_RETRIES + count && wallpaperResult.length < count; i++) {
            let historyArray: HistoryEntry[] = [];

            try {
                // This should run sequentially
                // eslint-disable-next-line no-await-in-loop
                historyArray = await this._getHistoryEntry(count);
            } catch (error) {
                this._logger.warn('Failed getting image');

                if (Array.isArray(error) && error.length > 0 && error[0] instanceof HistoryEntry)
                    historyArray = error as HistoryEntry[];

                // Do not escalate yet, try again
            } finally {
                historyArray.forEach(element => {
                    if (!this._includesWallpaper(wallpaperResult, element.source.imageDownloadUrl))
                        wallpaperResult.push(element);
                });
            }

            // Image blocked, try again
        }

        if (wallpaperResult.length < count) {
            this._logger.warn('Returning less images than requested.');
            throw wallpaperResult;
        }

        return wallpaperResult;
    }
}

export {GenericJsonAdapter};
