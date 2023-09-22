/* eslint-disable */

declare module 'resource:///org/gnome/shell/ui/main.js' {
    import St from 'gi://St';

    import type * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

    // lazy inline declaration to avoid import chain
    declare class Panel extends St.Widget {
        addToStatusArea(role: string, indicator: PanelMenu.Button, position?: number, box?: unknown): PanelMenu.Button;
    }

    export function notify(title: string, message: string): void;

    export let panel: Panel;
}
