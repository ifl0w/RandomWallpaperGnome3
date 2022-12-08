/* eslint-disable */

// https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/popupMenu.js

import * as Clutter from '@gi-types/clutter';
import * as St from '@gi-types/st';


// https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/misc/signals.js
declare class EventEmitter {
    connectObject(args: unknown): unknown;
    connect_object(args: unknown): unknown;
    disconnect_object(args: unknown): unknown;
    disconnectObject(args: unknown): unknown;

    // don't know where these are:
    connect(key: string, callback: (actor: typeof this, state: unknown[]) => void): void;
}

declare class PopupMenuBase extends EventEmitter {
    actor: Clutter.Actor;
    box: St.BoxLayout;

    addMenuItem(menuItem: PopupMenuSection | PopupSubMenuMenuItem | PopupSeparatorMenuItem | PopupBaseMenuItem, position?: number): void;
    removeAll(): void;
}

declare class PopupBaseMenuItem extends St.BoxLayout {
    actor: typeof this;
    // get actor(): typeof this;
    get sensitive(): boolean;
    set sensitive(sensitive: boolean);
}

export class PopupMenu extends PopupMenuBase {
    constructor(sourceActor: Clutter.Actor, arrowAlignment: unknown, arrowSide: unknown)
}

export class PopupMenuItem extends PopupBaseMenuItem {
    constructor(text: string, params?: unknown)
    label: St.Label;
}

export class PopupSubMenuMenuItem extends PopupBaseMenuItem {
    constructor(text: string, wantIcon: boolean)

    label: St.Label;
    menu: PopupSubMenu;
}

export class PopupSubMenu extends PopupMenuBase {
    actor: St.ScrollView;
}

export class PopupMenuSection extends PopupMenuBase {
    actor: St.BoxLayout | Clutter.Actor;
}

export class PopupSeparatorMenuItem extends PopupBaseMenuItem {}
export class Switch extends St.Bin {}
export class PopupSwitchMenuItem extends PopupBaseMenuItem {
    constructor(text: string, active: boolean, params?: {
        reactive: boolean | undefined,
        activate: boolean | undefined,
        hover: boolean | undefined,
        style_class: unknown | null | undefined,
        can_focus: boolean | undefined
    })

    setToggleState(state: boolean): void;
}
export class PopupImageMenuItem extends PopupBaseMenuItem {}
export class PopupDummyMenu extends EventEmitter {}
export class PopupMenuManager {}
