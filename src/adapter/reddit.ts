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

    async requestRandomImage() {
        const subreddits = this._settings.getString('subreddits').split(',').map(s => s.trim()).join('+');
        const require_sfw = this._settings.getBoolean('allow-sfw');

        const url = encodeURI(`https://www.reddit.com/r/${subreddits}.json`);
        const message = this._bowl.newGetMessage(url);

        const response_body_bytes = await this._bowl.send_and_receive(message);

        try {
            const response_body: RedditResponse = JSON.parse(ByteArray.toString(response_body_bytes));

            const submissions = response_body.data.children.filter(child => {
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

            if (submissions.length === 0)
                throw new Error('No suitable submissions found!');

            let submission = null;
            let imageDownloadUrl = null;
            for (let i = 0; i < 5; i++) {
                const random = Utils.getRandomNumber(submissions.length);
                submission = submissions[random].data;
                imageDownloadUrl = this._ampDecode(submission.preview.images[0].source.url);

                if (!this._isImageBlocked(Utils.fileName(imageDownloadUrl)))
                    break;

                imageDownloadUrl = null;
            }

            if (!imageDownloadUrl || !submission)
                throw new Error('Only blocked images found.');

            const historyEntry = new HistoryEntry(null, this._sourceName, imageDownloadUrl);
            historyEntry.source.sourceUrl = `https://www.reddit.com/${submission.subreddit_name_prefixed}`;
            historyEntry.source.imageLinkUrl = `https://www.reddit.com/${submission.permalink}`;
            return historyEntry;
        } catch (e) {
            throw new Error(`Could not create request. (${e})`);
        }
    }
}

export {RedditAdapter};
