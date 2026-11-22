export * from './colors';
export * from './typography';
export * from './motion';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

/** Every outlined thing in the app uses this border width. */
export const outline = 3;
/** Height of the solid "3D" shadow under buttons and cards. */
export const lift = 5;
