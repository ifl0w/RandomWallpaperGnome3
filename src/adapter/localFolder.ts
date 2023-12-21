import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';
import {Logger} from './../logger.js';

// https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper
Gio._promisify(Gio.File.prototype, 'copy_async', 'copy_finish');

/**
 * Adapter for fetching from the local filesystem.
 */
class LocalFolderAdapter extends BaseAdapter {
    /**
     * Create a new local folder adapter.
     *
     * @param {string} id Unique ID
     * @param {string} name Custom name of this adapter
     */
    constructor(id: string, name: string) {
        super({
            defaultName: 'Local Folder',
            id,
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/localFolder/${id}/`,
        });
    }

    /**
     * Retrieves new URLs for images and crafts new HistoryEntries.
     *
     * @param {number} count Number of requested wallpaper
     * @returns {HistoryEntry[]} Array of crafted HistoryEntries
     * @throws {HistoryEntry[]} Array of crafted historyEntries, can be empty
     */
    requestRandomImage(count: number): Promise<HistoryEntry[]> {
        return new Promise((resolve, reject) => {
            const folder = Gio.File.new_for_path(this._settings.getString('folder'));
            const files = this._listDirectory(folder);
            const wallpaperResult: HistoryEntry[] = [];

            if (files.length < 1) {
                Logger.error('No files found', this);
                reject(wallpaperResult);
                return;
            }
            Logger.debug(`Found ${files.length} possible wallpaper in "${this._settings.getString('folder')}"`, this);

            const shuffledFiles = Utils.shuffleArray(files);

            for (let i = 0; i < shuffledFiles.length; i++) {
                const randomFile = shuffledFiles[i];
                const randomFilePath = randomFile.get_uri();

                if (randomFilePath) {
                    const historyEntry = new HistoryEntry(null, this._sourceName, randomFilePath);
                    historyEntry.source.sourceUrl = randomFilePath;

                    wallpaperResult.push(historyEntry);
                    if (wallpaperResult.length >= count)
                        break;
                } else {
                    Logger.error('Failed to get URI from file.');
                }
            }

            if (wallpaperResult.length < count) {
                Logger.warn('Returning less images than requested.', this);
                reject(wallpaperResult);
                return;
            }

            resolve(wallpaperResult);
        });
    }

    /**
     * Copies a file from the filesystem to the destination folder.
     *
     * @param {HistoryEntry} historyEntry The historyEntry to fetch
     * @returns {Promise<HistoryEntry>} unaltered HistoryEntry
     */
    async fetchFile(historyEntry: HistoryEntry): Promise<HistoryEntry> {
        const sourceFile = Gio.File.new_for_uri(historyEntry.source.imageDownloadUrl);
        const targetFile = Gio.File.new_for_path(historyEntry.path);

        // https://gjs.guide/guides/gio/file-operations.html#copying-and-moving-files
        if (!await sourceFile.copy_async(targetFile, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, null, null))
            throw new Error('Failed copying image.');

        return historyEntry;
    }

    // https://gjs.guide/guides/gio/file-operations.html#recursively-deleting-a-directory
    /**
     * Walk recursively through a folder and retrieve a list of all images.
     *
     * This already checks for blocked filenames and omits them from the returned list.
     *
     * @param {Gio.File} directory Directory to scan
     * @returns {Gio.File[]} List of images
     */
    private _listDirectory(directory: Gio.File): Gio.File[] {
        const iterator = directory.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);

        let files: Gio.File[] = [];
        while (true) {
            const info = iterator.next_file(null);

            if (info === null)
                break;

            const child = iterator.get_child(info);
            const type = info.get_file_type();

            switch (type) {
            case Gio.FileType.DIRECTORY:
                files = files.concat(this._listDirectory(child));
                break;

            default:
                break;
            }

            const contentType = info.get_content_type();
            const filename = child.get_basename();
            if (contentType?.startsWith('image/') && filename && !this._isImageBlocked(filename))
                files.push(child);
        }

        return files;
    }
}

export {LocalFolderAdapter};
