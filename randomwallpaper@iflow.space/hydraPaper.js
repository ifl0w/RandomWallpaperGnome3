const Gio = imports.gi.Gio;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Self.imports.utils;

var HydraPaper = class {
	#hydraPaperCommand = null;
	#hydraPaperCancellable = null;

	constructor() { }

	/**
	 * Check whether HydraPaper is available on this system.
	 * @returns {boolean} - Whether HydraPaper is available
	 */
	async isAvailable() {
		if (this.#hydraPaperCommand !== null) {
			return true;
		}

		try {
			// Normal installation:
			await Utils.Utils.execCheck(['hydrapaper', '--help']);

			this.#hydraPaperCommand = ['hydrapaper'];
			return true;
		} catch (error) {
			// logError(error);
		}

		try {
			// FlatPak installation:
			await Utils.Utils.execCheck(['org.gabmus.hydrapaper', '--help']);

			this.#hydraPaperCommand = ['org.gabmus.hydrapaper'];
			return true;
		} catch (error) {
			// logError(error);
		}

		return this.#hydraPaperCommand !== null;
	}

	/**
	 * Cancel all running processes
	 * @returns
	 */
	cancelRunning() {
		if (this.#hydraPaperCancellable === null) {
			return;
		}

		this.#hydraPaperCancellable.cancel();
		this.#hydraPaperCancellable = null;
	}

	/**
	 * Generate a new combined wallpaper from multiple paths.
	 *
	 * @param {Array<string>} wallpaperArray Array of wallpaper paths matching the monitor count
	 * @param {boolean} darkmode Turn on darkmode, this results into a different cache file
	 */
	async run(wallpaperArray, darkmode) {
		// Cancel already running processes before starting new ones
		this.cancelRunning();

		// Needs a copy here
		let hydraPaperCommand = [...this.#hydraPaperCommand];

		if (darkmode) {
			hydraPaperCommand.push('--darkmode');
		}

		hydraPaperCommand.push('--cli');
		hydraPaperCommand = hydraPaperCommand.concat(wallpaperArray);

		try {
			this.#hydraPaperCancellable = new Gio.Cancellable();

			// hydrapaper [--darkmode] --cli PATH PATH PATH
			await Utils.Utils.execCheck(hydraPaperCommand, this.#hydraPaperCancellable);

			this.#hydraPaperCancellable = null;
		} catch (error) {
			logError(error);
		}
	}
}
