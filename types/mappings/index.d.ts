// These mappings from '@gi-types/*' to 'gi://*' are somehow missing but exist in the real gnome environment
declare module 'gi://Clutter' {
    export * from '@gi-types/clutter';
}

declare module 'gi://Cogl' {
    export * from '@gi-types/cogl';
}

declare module 'gi://St' {
    export * from '@gi-types/st';
}
