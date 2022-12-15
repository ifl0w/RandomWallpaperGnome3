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
    private _timeoutEndCallback?: () => Promise<void> = undefined;
    private _minutes = 30;
    private _paused = false;

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

    /**
     * Continue a paused timer.
     *
     * Removes the pause lock and starts the timer.
     * If the trigger time was surpassed while paused the callback gets
     * called directly and the next trigger is scheduled at the
     * next correct time frame repeatedly.
     */
    continue() {
        if (!this.isActive())
            return;

        this._paused = false;
        this.start();
    }

    isActive() {
        return this._settings.getBoolean('auto-fetch');
    }

    isPaused() {
        return this._paused;
    }

    /**
     * Pauses the timer.
     *
     * This stops any currently running timer and prohibits starting
     * until continue() was called.
     * 'timer-last-trigger' stays the same.
     */
    pause() {
        this._paused = true;
        this.cleanup();
    }

    remainingMinutes() {
        const minutesElapsed = this._minutesElapsed();
        const remainder = minutesElapsed % this._minutes;
        return Math.max(this._minutes - remainder, 0);
    }

    registerCallback(callback: () => Promise<void>) {
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
     *
     * Starts the timer if not paused.
     * Removes any previously running timer.
     * If the trigger time was surpassed the callback gets started
     * directly and the next trigger is scheduled at the
     * next correct time frame repeatedly.
     */
    async start() {
        if (this._paused)
            return;

        this.cleanup();

        const last = this._settings.getInt64('timer-last-trigger');
        if (last === 0)
            this._reset();

        const millisecondsRemaining = this.remainingMinutes() * 60 * 1000;

        // set new wallpaper if the interval was surpassed and set the timestamp to when it should have been updated
        if (this._surpassedInterval()) {
            if (this._timeoutEndCallback) {
                try {
                    await this._timeoutEndCallback();
                } catch (error) {
                    this._logger.error(error);
                }
            }

            const millisecondsOverdue = (this._minutes * 60 * 1000) - millisecondsRemaining;
            this._settings.setInt64('timer-last-trigger', Date.now() - millisecondsOverdue);
        }

        // actual timer function
        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, millisecondsRemaining, () => {
            if (this._timeoutEndCallback) {
                this._timeoutEndCallback().then(() => {
                    this._reset();
                    this.start().catch(this._logger.error);
                }).catch(this._logger.error).finally(() => {
                    return GLib.SOURCE_REMOVE;
                });
            }
            return GLib.SOURCE_REMOVE;
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
     * Sets the last activation time to [now]. This doesn't affect already running timer.
     */
    private _reset() {
        this._settings.setInt64('timer-last-trigger', new Date().getTime());
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
