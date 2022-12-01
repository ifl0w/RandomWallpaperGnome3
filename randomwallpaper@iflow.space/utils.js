const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var Utils = class {
	static getRandomNumber(size) {
		return Math.floor(Math.random() * size);
	}

	// https://gjs.guide/guides/gio/subprocesses.html#waiting-for-processes
	static runCommand(argv) {
		return new Promise((resolve, reject) => {
			try {
				let proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);

				proc.wait_async(null, (proc, result) => {
					try {
						resolve(proc.wait_finish(result));
					} catch (error) {
						reject(error);
					}
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	// https://gjs.guide/guides/gio/subprocesses.html#complete-examples
	/**
	 * Execute a command asynchronously and check the exit status.
	 *
	 * If given, @cancellable can be used to stop the process before it finishes.
	 *
	 * @param {string[]} argv - a list of string arguments
	 * @param {Gio.Cancellable} [cancellable] - optional cancellable object
	 * @returns {Promise<>} - The process success
	 */
	static async #execCheck(argv, cancellable = null) {
		let cancelId = 0;
		let proc = new Gio.Subprocess({
			argv: argv,
			flags: Gio.SubprocessFlags.NONE
		});
		proc.init(cancellable);

		if (cancellable instanceof Gio.Cancellable) {
			cancelId = cancellable.connect(() => proc.force_exit());
		}

		return new Promise((resolve, reject) => {
			proc.wait_check_async(null, (proc, res) => {
				try {
					if (!proc.wait_check_finish(res)) {
						let status = proc.get_exit_status();

						throw new Gio.IOErrorEnum({
							code: Gio.io_error_from_errno(status),
							message: GLib.strerror(status)
						});
					}

					resolve();
				} catch (e) {
					reject(e);
				} finally {
					if (cancelId > 0) {
						cancellable.disconnect(cancelId);
					}
				}
			});
		});
	}
}
