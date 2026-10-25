// Single entry point for an OEM customization:
// brand.ts (names, logos), theme.ts (colors, fonts, sizes) and the fonts below.
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import theme from './theme';

export { default as brand } from './brand';
export type { Brand } from './brand';
export { default as theme } from './theme';

// Palette shortcut for places that need raw color values (chart series, gauge fills).
// Inside sx/color props prefer theme paths like 'success.main'.
export const palette = theme.palette;
