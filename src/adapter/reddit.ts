import * as ByteArray from '@gi-types/gjs-environment/legacyModules/byteArray';

import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';
import {SoupBowl} from './../soupBowl.js';

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

class RedditAdapter extends BaseAdapter {
    private _bowl = new SoupBowl();

    constructor(id: string, name: string, wallpaperLocation: string) {
        super({
            defaultName: 'Reddit',
            id,
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_REDDIT,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/reddit/${id}/`,
            wallpaperLocation,
        });
    }

    private _ampDecode(string: string) {
        return string.replace(/&amp;/g, '&');
    }

    async requestRandomImage(count: number) {
        const wallpaperResult: HistoryEntry[] = [];
        const subreddits = this._settings.getString('subreddits').split(',').map(s => s.trim()).join('+');
        const require_sfw = this._settings.getBoolean('allow-sfw');

        const url = encodeURI(`https://www.reddit.com/r/${subreddits}.json`);
        const message = this._bowl.newGetMessage(url);

        const response_body_bytes = await this._bowl.send_and_receive(message);

        const response_body: RedditResponse = JSON.parse(ByteArray.toString(response_body_bytes));

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

        if (filteredSubmissions.length === 0)
            throw new Error('No suitable submissions found!');

        for (let i = 0; i < 20 && wallpaperResult.length < count; i++) {
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

        if (wallpaperResult.length === 0)
            throw new Error('Only blocked images found.');

        return wallpaperResult;
    }
}

export {RedditAdapter};
