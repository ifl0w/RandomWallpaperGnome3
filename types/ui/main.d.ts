import * as St from '@gi-types/st';
import * as PanelMenu from '@gi/ui/panelMenu';

declare class Panel extends St.Widget {
    addToStatusArea(role: string, indicator: PanelMenu.Button, position?: number, box?: unknown): PanelMenu.Button
}

export const panel: Panel;
