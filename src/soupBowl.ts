/**
 * A compatibility and convenience wrapper around the Soup API.
 *
 * libSoup is accessed through the SoupBowl wrapper to support libSoup3 and libSoup2.4 simultaneously in the extension
 * runtime and in the preferences window.
 */
import * as GLib from 'gi://GLib';
import * as Soup from 'gi://Soup';

import {Logger} from './logger.js';

class SoupBowl {
    MessageFlags = Soup.MessageFlags;

    private _logger = new Logger('RWG3', 'BaseAdapter');
    private _session = new Soup.Session();

    send_and_receive(soupMessage: Soup.Message): Promise<Uint8Array> {
        if (Soup.get_major_version() === 2)
            return this._send_and_receive_soup24(soupMessage);
        else if (Soup.get_major_version() === 3)
            return this._send_and_receive_soup30(soupMessage);
        else
            throw new Error('Unknown libsoup version');
    }

    newGetMessage(uri: string): Soup.Message {
        return Soup.Message.new('GET', uri);
    }

    // Possibly wrong version here causing ignores to type checks
    private _send_and_receive_soup24(soupMessage: Soup.Message): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            this._session.queue_message(soupMessage, (session, msg) => {
                if (!msg.response_body) {
                    reject(new Error('Message has no response body'));
                    return;
                }

                const response_body_bytes = msg.response_body.flatten().get_data();
                resolve(response_body_bytes);
            });
        });
    }

    // Possibly wrong version here causing ignores to type checks
    private _send_and_receive_soup30(soupMessage: Soup.Message): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            this._session.send_and_read_async(soupMessage, 0, null, (session: Soup.Session, message: Soup.Message) => {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                const res_data = session.send_and_read_finish(message) as GLib.Bytes | null;
                if (!res_data) {
                    reject(new Error('Message has no response body'));
                    return;
                }

                const response_body_bytes = res_data.get_data();

                if (response_body_bytes)
                    resolve(response_body_bytes);
                else
                    reject(new Error('Empty response'));
            });
        });
    }
}

export {SoupBowl};
