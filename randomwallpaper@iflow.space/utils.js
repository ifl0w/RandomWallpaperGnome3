const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var Utils = class {
	/**
	 * Get the monitor count for the default "seat".
	 * @returns Number
	 */
	static getMonitorCount() {
		// Gdk 4.8+
		// Gdk.DisplayManager.get()
		// displayManager.get_default_display()
		// display.get_monitors()
		// monitors.get_n_items() <- Monitor count, number

		// let defaultDisplay = Gdk.Display.get_default(); // default "seat" which can have multiple monitors
		// let monitorList = defaultDisplay.get_monitors(); // Gio.ListModel containing all "Gdk.Monitor"
		// return monitorList.get_n_items();

		// Gdk < 4.8
		let defaultDisplay = Gdk.Display.get_default(); // default "seat" which can have multiple monitors
		return defaultDisplay.get_n_monitors();
	}

	static getRandomNumber(size) {
		return Math.floor(Math.random() * size);
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
	static async execCheck(argv, cancellable = null) {
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

	// https://stackoverflow.com/a/5767357
	static removeItemOnce(arr, value) {
		var index = arr.indexOf(value);
		if (index > -1) {
			arr.splice(index, 1);
		}
		return arr;
	}
}
