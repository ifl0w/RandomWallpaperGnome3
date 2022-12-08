import * as GLib from 'gi://GLib';

import {Logger} from './logger.js';
import {Settings} from './settings.js';

/**
 * Timer for the auto fetch feature.
 */
class AFTimer {
    private static _afTimerInstance?: AFTimer | null = null;

    private _logger = new Logger('RWG3', 'Timer');
    private _settings = new Settings();
    private _timeout?: number = undefined;
    private _timeoutEndCallback?: () => void = undefined;
    private _minutes = 30;

    static getTimer(): AFTimer {
        if (!this._afTimerInstance)
            this._afTimerInstance = new AFTimer();

        return this._afTimerInstance;
    }

    static destroy() {
        if (this._afTimerInstance)
            this._afTimerInstance.cleanup();

        this._afTimerInstance = null;
    }

    isActive() {
        return this._settings.getBoolean('auto-fetch');
    }

    remainingMinutes() {
        const minutesElapsed = this._minutesElapsed();
        const remainder = minutesElapsed % this._minutes;
        return Math.max(this._minutes - remainder, 0);
    }

    registerCallback(callback: () => void) {
        this._timeoutEndCallback = callback;
    }

    /**
     * Sets the minutes of the timer.
     *
     * @param {number} minutes Number in minutes
     */
    setMinutes(minutes: number) {
        this._minutes = minutes;
    }

    /**
     * Start the timer.
     */
    start() {
        this.cleanup();

        const last = this._settings.getInt64('timer-last-trigger');
        if (last === 0)
            this.reset();

        const millisecondsRemaining = this.remainingMinutes() * 60 * 1000;

        // set new wallpaper if the interval was surpassed and set the timestamp to when it should have been updated
        if (this._surpassedInterval()) {
            if (this._timeoutEndCallback)
                this._timeoutEndCallback();

            const millisecondsOverdue = (this._minutes * 60 * 1000) - millisecondsRemaining;
            this._settings.setInt64('timer-last-trigger', Date.now() - millisecondsOverdue);
        }

        // actual timer function
        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, millisecondsRemaining, () => {
            if (this._timeoutEndCallback)
                this._timeoutEndCallback();

            this.reset(); // reset timer
            this.start(); // restart timer

            return true;
        });
    }

    /**
     * Stop the timer.
     */
    stop() {
        this._settings.setInt64('timer-last-trigger', 0);
        this.cleanup();
    }

    /**
     * Cleanup the timeout callback if it exists.
     */
    cleanup() {
        if (this._timeout) { // only remove if a timeout is active
            GLib.source_remove(this._timeout);
            this._timeout = undefined;
        }
    }

    /**
     * Reset the timer.
     */
    reset() {
        this._settings.setInt64('timer-last-trigger', new Date().getTime());
        this.cleanup();
    }

    private _minutesElapsed() {
        const now = Date.now();
        const last: number = this._settings.getInt64('timer-last-trigger');

        if (last === 0)
            return 0;

        const elapsed = Math.max(now - last, 0);
        return Math.floor(elapsed / (60 * 1000));
    }

    private _surpassedInterval() {
        const now = Date.now();
        const last = this._settings.getInt64('timer-last-trigger');
        const diff = now - last;
        const intervalLength = this._minutes * 60 * 1000;

        return diff > intervalLength;
    }
}

export {AFTimer};
