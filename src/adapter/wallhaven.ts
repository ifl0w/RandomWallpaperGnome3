import * as ByteArray from '@gi-types/gjs-environment/legacyModules/byteArray';

import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';
import {SoupBowl} from './../soupBowl.js';

interface QueryOptions {
    q: string,
    apikey: string,
    purity: string,
    sorting: string,
    categories: string,
    resolutions: string[],
    colors: string,
    // atleast: string,
    // ratios: string[],
    // order: string,
    // topRange: string,
}

interface WallhavenSearchResponse {
    data: {
        path:  string,
        url: string,
    }[]
}

class WallhavenAdapter extends BaseAdapter {
    private _bowl = new SoupBowl();
    private _options: QueryOptions = {
        q: '',
        apikey: '',
        purity: '110', // SFW, sketchy
        sorting: 'random',
        categories: '111', // General, Anime, People
        resolutions: ['1920x1200', '2560x1440'],
        colors: '',
    };

    constructor(id: string, name: string, wallpaperLocation: string) {
        super({
            id,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/wallhaven/${id}/`,
            wallpaperLocation,
            name,
            defaultName: 'Wallhaven',
        });
    }

    async requestRandomImage() {
        this._readOptionsFromSettings();
        const optionsString = this._generateOptionsString(this._options);

        const url = `https://wallhaven.cc/api/v1/search?${encodeURI(optionsString)}`;
        const message = this._bowl.newGetMessage(url);

        const response_body_bytes = await this._bowl.send_and_receive(message);

        let response: WallhavenSearchResponse['data'];
        try {
            response = JSON.parse(ByteArray.toString(response_body_bytes)).data;
        } catch {
            throw new Error('Error parsing API.');
        }
        if (!response || response.length === 0)
            throw new Error('Empty response');

        let downloadURL: string | null = null;
        let siteURL: string = '';
        for (let i = 0; i < 5; i++) {
            // get a random entry from the array
            const entry = response[Utils.getRandomNumber(response.length)];
            downloadURL = entry.path;
            siteURL = entry.url;

            if (!this._isImageBlocked(Utils.fileName(downloadURL)))
                break;

            downloadURL = null;
        }

        if (!downloadURL)
            throw new Error('Only blocked images found.');

        const apiKey = this._options['apikey'];
        if (apiKey !== '')
            downloadURL += `?apikey=${apiKey}`;

        const historyEntry = new HistoryEntry(null, this._sourceName, downloadURL);
        historyEntry.source.sourceUrl = 'https://wallhaven.cc/';
        historyEntry.source.imageLinkUrl = siteURL;
        return historyEntry;
    }

    private _generateOptionsString<T extends QueryOptions>(options: T) {
        let optionsString = '';

        for (const key in options) {
            if (options.hasOwnProperty(key)) {
                if (Array.isArray(options[key]))
                    // eslint-disable-next-line no-extra-parens
                    optionsString += `${key}=${(options[key] as Array<string>).join()}&`;
                else if (options[key] !== '')
                    optionsString += `${key}=${options[key]}&`;
            }
        }

        return optionsString;
    }

    private _readOptionsFromSettings() {
        const keywords = this._settings.getString('keyword').split(',');
        if (keywords.length > 0) {
            const randomKeyword = keywords[Utils.getRandomNumber(keywords.length)];
            this._options.q = randomKeyword.trim();
        }
        this._options.apikey = this._settings.getString('api-key');

        this._options.resolutions = this._settings.getString('resolutions').split(',');
        this._options.resolutions = this._options.resolutions.map(elem => {
            return elem.trim();
        });

        let categories = [];
        categories.push(Number(this._settings.getBoolean('category-general'))); // + is implicit conversion to int
        categories.push(Number(this._settings.getBoolean('category-anime')));
        categories.push(Number(this._settings.getBoolean('category-people')));
        this._options.categories = categories.join('');

        let purity = [];
        purity.push(Number(this._settings.getBoolean('allow-sfw')));
        purity.push(Number(this._settings.getBoolean('allow-sketchy')));
        purity.push(Number(this._settings.getBoolean('allow-nsfw')));
        this._options.purity = purity.join('');

        this._options.colors = this._settings.getString('color');
    }
}

export {WallhavenAdapter};
