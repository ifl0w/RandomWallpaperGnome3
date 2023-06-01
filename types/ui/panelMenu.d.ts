/* eslint-disable */

import St from 'gi://St';

import {PopupMenu} from '@gi/ui/popupMenu';

declare class ButtonBox extends St.Widget{}

export class Button extends ButtonBox {
    menu: PopupMenu;

    constructor(menuAlignment: number, nameText: string, dontCreateMenu?: boolean);
}
