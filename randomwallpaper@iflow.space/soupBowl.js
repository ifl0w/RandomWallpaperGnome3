/**
 * A compatibility and convenience wrapper around the Soup API.
 */
const Self = imports.misc.extensionUtils.getCurrentExtension();
const LoggerModule = Self.imports.logger;

imports.gi.versions.Soup = '3.0';

try {
    const _s = imports.gi.Soup;
    // If Soup is already loaded, this check isn't enough and we need to verify the version
    if (_s.get_major_version() === 2)
        imports.gi.versions.Soup = '2.4';
} catch (e) {
    imports.gi.versions.Soup = '2.4';
}

const _Soup = imports.gi.Soup;

var Bowl = class {

    Soup = _Soup;

    constructor() {
        this.logger = new LoggerModule.Logger('RWG3', 'BaseAdapter');

        this.session = new _Soup.Session();

        if (imports.gi.versions.Soup === '2.4'){
            this.send_and_receive = this._send_and_receive_soup24;
        } else {
            this.send_and_receive = this._send_and_receive_soup30;
        }
    }

    /* stub */
    send_and_receive(soupMessage, callback) {};

    _send_and_receive_soup24(soupMessage, callback) {
        this.session.queue_message(soupMessage, (session, msg) => {
            if (!msg.response_body) {
                callback(null);
                return;
            }

            const response_body_bytes = msg.response_body.flatten().get_data();
            callback(response_body_bytes);
        });
    }

    _send_and_receive_soup30(soupMessage, callback) {
        this.session.send_and_read_async(soupMessage, 0, null, (session, message) => {
            const res_data = session.send_and_read_finish(message);
            if (!res_data) {
                callback(null);
                return;
            }

            const response_body_bytes = res_data.get_data();
            callback(response_body_bytes);
        });
    }

}
