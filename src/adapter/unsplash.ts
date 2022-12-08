import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';
import {SoupBowl} from './../soupBowl.js';

class UnsplashAdapter extends BaseAdapter {
    private _bowl = new SoupBowl();
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

    constructor(id: string | null, name: string | null, wallpaperLocation: string) {
        super({
            defaultName: 'Unsplash',
            id: id ?? '-1',
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_UNSPLASH,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/unsplash/${id}/`,
            wallpaperLocation,
        });
    }

    private async _getHistoryEntry(): Promise<HistoryEntry | null> {
        this._readOptionsFromSettings();
        const optionsString = this._generateOptionsString();

        let url = `https://source.unsplash.com${optionsString}`;
        url = encodeURI(url);

        this.logger.info(`Unsplash request to: ${url}`);

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
            return null;
        }

        const historyEntry = new HistoryEntry(null, this._sourceName, imageLinkUrl);
        historyEntry.source.sourceUrl = this._sourceUrl;
        historyEntry.source.imageLinkUrl = imageLinkUrl;

        return historyEntry;
    }

    async requestRandomImage() {
        for (let i = 0; i < 5; i++) {
            try {
                // This should run sequentially
                // eslint-disable-next-line no-await-in-loop
                const historyEntry = await this._getHistoryEntry();

                if (historyEntry)
                    return historyEntry;
            } catch (error) {
                this.logger.warn(`Failed getting image: ${error}`);
                // Do not escalate yet, try again
            }

            // Image blocked, try again
        }

        throw new Error('Only blocked images found.');
    }

    private _generateOptionsString() {
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

    private _readOptionsFromSettings() {
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
