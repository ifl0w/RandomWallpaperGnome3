// These mappings from '@girs/*' to 'gi://*' are somehow missing but exist in the real gnome environment
declare module 'gi://Clutter' {
    export * from '@girs/clutter-13';
}

declare module 'gi://Cogl' {
    export * from '@girs/cogl-13';
}

declare module 'gi://Meta' {
    export * from '@girs/Meta';
}

declare module 'gi://St' {
    export * from '@girs/st-13';
}

declare module 'gi://Soup' {
    export * from '@girs/soup-3.0';
}

declare module 'gi://GLib' {
    export * from '@girs/glib-2.0';
}

declare module 'gi://Adw' {
    export * from '@girs/adw-1';
}
