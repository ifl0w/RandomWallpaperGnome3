/* eslint-disable */

declare module 'panelMenu' {
    import St from 'gi://St';

    import {PopupMenu} from 'popupMenu';

    export class ButtonBox extends St.Widget{}

    export class Button extends ButtonBox {
        menu: PopupMenu;

        constructor(menuAlignment: number, nameText: string, dontCreateMenu?: boolean);
    }
}
