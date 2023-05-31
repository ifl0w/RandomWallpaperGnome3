import Gio from 'gi://Gio';

import * as SettingsModule from './../settings.js';

import {HistoryEntry} from './../history.js';
import {Logger} from './../logger.js';
import {SoupBowl} from './../soupBowl.js';

abstract class BaseAdapter {
    protected _bowl = new SoupBowl();

    protected _generalSettings: SettingsModule.Settings;
    protected _logger: Logger;
    protected _settings: SettingsModule.Settings;
    protected _sourceName: string;

    constructor(params: {
        defaultName: string;
        id: string;
        name: string | null;
        schemaID: string;
        schemaPath: string;
    }) {
        const path = `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/general/${params.id}/`;
        this._logger = new Logger('RWG3', `${params.defaultName} adapter`);

        this._settings = new SettingsModule.Settings(params.schemaID, params.schemaPath);
        this._sourceName = params.name ?? params.defaultName;

        this._generalSettings = new SettingsModule.Settings(
            SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_GENERAL,
            path
        );
    }

    /**
     * Retrieves a new url for an image and crafts a new HistoryEntry.
     *
     * @param {number} count Number of requested wallpaper
     * @throws {HistoryEntry[]} Array of crafted historyEntries, can be empty
     */
    // eslint-disable-next-line no-unused-vars
    abstract requestRandomImage (count: number): Promise<HistoryEntry[]>;

    /**
     * copy file from uri to local wallpaper directory and returns the full filepath
     * of the written file.
     *
     * @param {HistoryEntry} historyEntry The historyEntry to fetch
     */
    async fetchFile(historyEntry: HistoryEntry): Promise<HistoryEntry> {
        const file = Gio.file_new_for_path(historyEntry.path);
        const fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // craft new message from details
        const request = this._bowl.newGetMessage(historyEntry.source.imageDownloadUrl);

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

    protected _includesWallpaper(array: HistoryEntry[], uri: string): boolean {
        for (const element of array) {
            if (element.source.imageDownloadUrl === uri)
                return true;
        }

        return false;
    }

    /**
     * Check if this image is in the list of blocked images.
     *
     * @param {string} filename Name of the image
     */
    protected _isImageBlocked(filename: string): boolean {
        const blockedFilenames = this._generalSettings.getStrv('blocked-images');

        if (blockedFilenames.includes(filename)) {
            this._logger.info(`Image is blocked: ${filename}`);
            return true;
        }

        return false;
    }

    // eslint-disable-next-line no-unused-vars
    protected _error(err: string, callback?: (element: null, error: { error: string }) => void): void {
        const error = {error: err};
        this._logger.error(JSON.stringify(error));

        if (callback)
            callback(null, error);
    }
}

export {BaseAdapter};
