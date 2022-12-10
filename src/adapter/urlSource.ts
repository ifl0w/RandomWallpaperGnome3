import * as SettingsModule from './../settings.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';

class UrlSourceAdapter extends BaseAdapter {
    constructor(id: string, name: string, wallpaperLocation: string) {
        super({
            defaultName: 'Static URL',
            id,
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_URL_SOURCE,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/urlSource/${id}/`,
            wallpaperLocation,
        });
    }

    requestRandomImage(unusedCount: number) {
        const imageDownloadUrl = this._settings.getString('image-url');
        let authorName: string | null = this._settings.getString('author-name');
        const authorUrl = this._settings.getString('author-url');
        const domainUrl = this._settings.getString('domain');
        const postUrl = this._settings.getString('domain');

        if (imageDownloadUrl === '')
            throw new Error('Missing download url');

        if (authorName === '')
            authorName = null;

        const historyEntry = new HistoryEntry(authorName, this._sourceName, imageDownloadUrl);

        if (authorUrl !== '')
            historyEntry.source.authorUrl = authorUrl;

        if (postUrl !== '')
            historyEntry.source.imageLinkUrl = postUrl;


        if (domainUrl !== '')
            historyEntry.source.sourceUrl = domainUrl;

        return Promise.resolve([historyEntry]);
    }
}

export {UrlSourceAdapter};
