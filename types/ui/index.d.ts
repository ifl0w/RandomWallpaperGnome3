/* eslint-disable */
// doing similar to https://github.com/gi-ts/environment

/// <reference path='./main.d.ts' />
/// <reference path='./panelMenu.d.ts' />
/// <reference path='./popupMenu.d.ts' />

declare interface GjsUiImports {
    main: typeof import('main');
    panelMenu: typeof import('panelMenu');
    popupMenu: typeof import('popupMenu');
}

// extend imports interface with ui elements
declare interface GjsImports {
    ui: GjsUiImports;
}
