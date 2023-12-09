/* eslint-disable */

declare module 'resource:///org/gnome/shell/ui/panelMenu.js' {
    import St from 'gi://St';

    import {PopupMenu} from 'resource:///org/gnome/shell/ui/popupMenu.js';

    export class ButtonBox extends St.Widget{}

    export class Button extends ButtonBox {
        menu: PopupMenu;

        constructor(menuAlignment: number, nameText: string, dontCreateMenu?: boolean);
    }
}
