/* eslint-disable */

import {PopupMenu} from '@gi/ui/popupMenu';
import * as St from '@gi-types/st';

declare class ButtonBox extends St.Widget{}

export class Button extends ButtonBox {
    menu: PopupMenu;

    constructor(menuAlignment: number, nameText: string, dontCreateMenu?: boolean);
}
