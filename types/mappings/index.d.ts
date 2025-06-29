// These mappings from '@girs/*' to 'gi://*' are somehow missing but exist in the real gnome environment
//declare module 'gi://Clutter' {
//    export * from '@girs/clutter-16';
//}
//
//declare module 'gi://Cogl' {
//    export * from '@girs/cogl-16';
//}
//
//declare module 'gi://Meta' {
//    export * from '@girs/Meta';
//}
//
//declare module 'gi://GdkPixbuf' {
//    export * from '@girs/gdkpixbuf-2.0'
//}
//
//declare module 'gi://St' {
//    export * from '@girs/st-16';
//}
//
//
//declare module 'gi://GLib' {
//    export * from '@girs/glib-2.0';
//}
//
//declare module 'gi://Adw' {
//    export * from '@girs/adw-1';
//}
//
//declare module 'gi://gjs' {
//    export * from '@girs/gjs';
//}

import "@girs/gjs";
import "@girs/gjs/dom";
import "@girs/gnome-shell/ambient";
import "@girs/gnome-shell/extensions/global";
import '@girs/soup-3.0/ambient';
