import * as Gio from 'gi://Gio';
import * as GLib from 'gi://GLib';

import * as SettingsModule from './../settings.js';
import * as Utils from './../utils.js';

import {BaseAdapter} from './../adapter/baseAdapter.js';
import {HistoryEntry} from './../history.js';

// https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper
Gio._promisify(Gio.File.prototype, 'copy_async', 'copy_finish');

class LocalFolderAdapter extends BaseAdapter {
    constructor(id: string, name: string, wallpaperLocation: string) {
        super({
            defaultName: 'Local Folder',
            id,
            name,
            schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_LOCAL_FOLDER,
            schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/localFolder/${id}/`,
            wallpaperLocation,
        });
    }

    requestRandomImage(): Promise<HistoryEntry> {
        return new Promise((resolve, reject) => {
            const folder = Gio.File.new_for_path(this._settings.getString('folder'));
            const files = this._listDirectory(folder);

            if (files.length < 1) {
                reject(new Error('No files found'));
                return;
            }

            let randomFilePath: string | null = null;
            for (let i = 0; i < 5; i++) {
                const randomFile = files[Utils.getRandomNumber(files.length)];
                randomFilePath = randomFile.get_uri();
                const randomFileName = randomFile.get_basename();

                if (randomFileName && !this._isImageBlocked(randomFileName))
                    break;

                randomFilePath = null;
            }

            if (!randomFilePath) {
                reject(new Error('Only blocked images found'));
                return;
            }

            const historyEntry = new HistoryEntry(null, this._sourceName, randomFilePath);
            historyEntry.source.sourceUrl = this._wallpaperLocation;
            resolve(historyEntry);
        });
    }

    async fetchFile(historyEntry: HistoryEntry) {
        const sourceFile = Gio.File.new_for_uri(historyEntry.source.imageDownloadUrl);
        const name = sourceFile.get_basename();
        const targetFile = Gio.File.new_for_path(this._wallpaperLocation + String(name));

        // https://gjs.guide/guides/gio/file-operations.html#copying-and-moving-files
        // This function was rewritten by Gio._promisify
        // @ts-expect-error
        if (!await sourceFile.copy_async(targetFile, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, null, null))
            throw new Error('Failed copying image.');

        return targetFile;
    }

    // https://gjs.guide/guides/gio/file-operations.html#recursively-deleting-a-directory
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
            if (contentType === 'image/png' || contentType === 'image/jpeg')
                files.push(child);
        }

        return files;
    }
}

export {LocalFolderAdapter};
