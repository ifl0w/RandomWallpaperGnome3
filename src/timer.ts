import GLib from 'gi://GLib';

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

    /**
     * Get the timer singleton.
     *
     * @returns {AFTimer} Timer object
     */
    static getTimer(): AFTimer {
        if (!this._afTimerInstance)
            this._afTimerInstance = new AFTimer();

        return this._afTimerInstance;
    }

    /**
     * Remove the timer singleton.
     */
    static destroy(): void {
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
    continue(): void {
        if (!this.isActive())
            return;

        this._logger.debug('Continuing timer');
        this._paused = false;

        // We don't care about awaiting. This should start immediately and
        // run continuously in the background.
        void this.start();
    }

    /**
     * Check if the timer is currently set as activated.
     *
     * @returns {boolean} Wether the timer is activated
     */
    isActive(): boolean {
        return this._settings.getBoolean('auto-fetch');
    }

    /**
     * Check if the timer is currently paused.
     *
     * @returns {boolean} Wether the timer is paused
     */
    isPaused(): boolean {
        return this._paused;
    }

    /**
     * Pauses the timer.
     *
     * This stops any currently running timer and prohibits starting
     * until continue() was called.
     * 'timer-last-trigger' stays the same.
     */
    pause(): void {
        this._logger.debug('Timer paused');
        this._paused = true;
        this.cleanup();
    }

    /**
     * Get the minutes until the timer activates.
     *
     * @returns {number} Minutes to activation
     */
    remainingMinutes(): number {
        const minutesElapsed = this._minutesElapsed();
        const remainder = minutesElapsed % this._minutes;
        return Math.max(this._minutes - remainder, 0);
    }

    /**
     * Register a function which gets called on timer activation.
     *
     * Overwrites previously registered function.
     *
     * @param {() => Promise<void>} callback Function to call
     */
    registerCallback(callback: () => Promise<void>): void {
        this._timeoutEndCallback = callback;
    }

    /**
     * Sets the minutes of the timer.
     *
     * @param {number} minutes Number in minutes
     */
    setMinutes(minutes: number): void {
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
     *
     * @param {boolean | undefined} forceTrigger Force calling the timeoutEndCallback on initial call
     */
    async start(forceTrigger: boolean = false): Promise<void> {
        if (this._paused)
            return;

        this.cleanup();

        const last = this._settings.getInt64('timer-last-trigger');
        if (last === 0)
            this._reset();

        const millisecondsRemaining = this.remainingMinutes() * 60 * 1000;

        // set new wallpaper if the interval was surpassed…
        const intervalSurpassed = this._surpassedInterval();
        if (forceTrigger || intervalSurpassed) {
            if (this._timeoutEndCallback) {
                this._logger.debug('Running callback now');

                try {
                    await this._timeoutEndCallback();
                } catch (error) {
                    this._logger.error(error);
                }
            }
        }

        // …and set the timestamp to when it should have been updated
        if (intervalSurpassed) {
            const millisecondsOverdue = (this._minutes * 60 * 1000) - millisecondsRemaining;
            this._settings.setInt64('timer-last-trigger', Date.now() - millisecondsOverdue);
        }

        // actual timer function
        this._logger.debug(`Starting timer, will run callback in ${millisecondsRemaining}ms`);
        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, millisecondsRemaining, () => {
            // Reset time immediately to avoid shifting the timer
            this._reset();

            // Call this function again and forcefully skip the surpassed timer check so it will run the timeoutEndCallback
            this.start(true).catch(error => {
                this._logger.error(error);
            });

            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Stop the timer.
     */
    stop(): void {
        this._settings.setInt64('timer-last-trigger', 0);
        this.cleanup();
    }

    /**
     * Cleanup the timeout callback if it exists.
     */
    cleanup(): void {
        if (this._timeout) { // only remove if a timeout is active
            this._logger.debug('Removing running timer');
            GLib.source_remove(this._timeout);
            this._timeout = undefined;
        }
    }

    /**
     * Sets the last activation time to [now]. This doesn't affect an already running timer.
     */
    private _reset(): void {
        this._settings.setInt64('timer-last-trigger', new Date().getTime());
    }

    /**
     * Get the elapsed minutes since the last timer activation.
     *
     * @returns {number} Elapsed time in minutes
     */
    private _minutesElapsed(): number {
        const now = Date.now();
        const last: number = this._settings.getInt64('timer-last-trigger');

        if (last === 0)
            return 0;

        const elapsed = Math.max(now - last, 0);
        return Math.floor(elapsed / (60 * 1000));
    }

    /**
     * Checks if the configured timer interval has surpassed since the last timer activation.
     *
     * @returns {boolean} Whether the interval was surpassed
     */
    private _surpassedInterval(): boolean {
        const now = Date.now();
        const last = this._settings.getInt64('timer-last-trigger');
        const diff = now - last;
        const intervalLength = this._minutes * 60 * 1000;

        return diff > intervalLength;
    }
}

export {AFTimer};
