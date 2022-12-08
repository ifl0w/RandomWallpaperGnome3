import * as Gio from 'gi://Gio';

import * as Utils from './utils.js';

import {Settings} from './settings.js';

interface SourceInfo {
    author: string | null;
    authorUrl: string | null;
    source: string | null;
    sourceUrl: string | null;
    imageDownloadUrl: string;
    imageLinkUrl: string | null;
}

interface AdapterInfo {
    id: string | null;
    type: number | null;
}

class HistoryEntry {
    timestamp = new Date().getTime();
    id: string;
    name: string;
    path: string | null = null;
    source: SourceInfo;
    adapter: AdapterInfo = {
        id: null,
        type: null,
    };

    constructor(author: string | null, source: string | null, url: string) {
        this.source = {
            author,
            authorUrl: null,
            source,
            sourceUrl: null,
            imageDownloadUrl: url, // URL used for downloading the image
            imageLinkUrl: url, // URL used for linking back to the website of the image
        };

        // extract the name from the url
        this.name = Utils.fileName(this.source.imageDownloadUrl);
        this.id = `${this.timestamp}_${this.name}`;
    }
}

class HistoryController {
    history: HistoryEntry[] = [];
    size = 10;

    private _settings = new Settings();
    private _wallpaperLocation: string;

    constructor(wallpaperLocation: string) {
        this._wallpaperLocation = wallpaperLocation;

        this.load();
    }

    insert(historyElement: HistoryEntry) {
        this.history.unshift(historyElement);
        this._deleteOldPictures();
        this.save();
    }

    /**
     * Set the given id to to the first history element (the current one)
     *
     * @param {string} id ID of the historyEntry
     */
    promoteToActive(id: string): boolean {
        const element = this.get(id);
        if (element === null)
            return false;


        element.timestamp = new Date().getTime();
        this.history = this.history.sort((elem1, elem2) => {
            return elem1.timestamp < elem2.timestamp ? 1 : 0;
        });
        this.save();

        return true;
    }

    /**
     * Returns the corresponding HistoryEntry or null
     *
     * @param {string} id ID of the historyEntry
     */
    get(id: string): HistoryEntry | null {
        for (const elem of this.history) {
            if (elem.id === id)
                return elem;
        }

        return null;
    }

    /**
     * Get the current history element.
     */
    getCurrentElement(): HistoryEntry {
        return this.history[0];
    }

    /**
     * Get a random HistoryEntry.
     */
    getRandom(): HistoryEntry {
        return this.history[Utils.getRandomNumber(this.history.length)];
    }

    /**
     * Load the history from the schema
     */
    load() {
        this.size = this._settings.getInt('history-length');

        const stringHistory: string[] = this._settings.getStrv('history');
        this.history = stringHistory.map((elem: string) => {
            return JSON.parse(elem);
        });
    }

    /**
     * Save the history to the schema
     */
    save() {
        const stringHistory = this.history.map(elem => {
            return JSON.stringify(elem);
        });
        this._settings.setStrv('history', stringHistory);
        Gio.Settings.sync();
    }

    /**
     * Clear the history and delete all photos except the current one.
     */
    clear(): boolean {
        const firstHistoryElement = this.history[0];

        if (firstHistoryElement)
            this.history = [firstHistoryElement];

        const directory = Gio.file_new_for_path(this._wallpaperLocation);
        const enumerator = directory.enumerate_children('', Gio.FileQueryInfoFlags.NONE, null);

        let fileInfo;
        let deleteFile;

        do {
            fileInfo = enumerator.next_file(null);

            if (!fileInfo)
                break;

            const id = fileInfo.get_name();

            // ignore hidden files and first element
            if (id[0] !== '.' && id !== firstHistoryElement.id) {
                deleteFile = Gio.file_new_for_path(this._wallpaperLocation + id);
                deleteFile.delete(null);
            }
        } while (fileInfo);

        this.save();
        return true;
    }

    /**
     * Delete all pictures that have no slot in the history.
     */
    private _deleteOldPictures() {
        this.size = this._settings.getInt('history-length');
        let deleteFile;
        while (this.history.length > this.size) {
            const path = this.history.pop()?.path;
            if (path) {
                deleteFile = Gio.file_new_for_path(path);
                deleteFile.delete(null);
            }
        }
    }
}

export {HistoryEntry, HistoryController};
