/* eslint-disable */

declare module 'main' {
    import St from 'gi://St';

    import * as PanelMenu from 'panelMenu';

    export class Panel extends St.Widget {
        addToStatusArea(role: string, indicator: PanelMenu.Button, position?: number, box?: unknown): PanelMenu.Button
    }

    export function notify(title: string, message: string): void;

    export const panel: Panel;
}
