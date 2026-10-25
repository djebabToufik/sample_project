import { createTheme } from '@mui/material/styles';

// App-wide look: colors, fonts and layout sizes.
// Components read these through the MUI theme (e.g. sx={{ color: 'primary.main' }}),
// so an OEM only changes values here.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1c1c1c',
    },
    // Status colors: KPI gauges, trend arrows, chart series (good = success, bad = error).
    // Values are MUI's defaults, listed so an OEM can see and change them.
    success: { main: '#2e7d32', light: '#4caf50', dark: '#1b5e20' },
    error: { main: '#d32f2f', light: '#ef5350', dark: '#c62828' },
    warning: { main: '#ed6c02', light: '#ff9800', dark: '#e65100' },
    info: { main: '#0288d1', light: '#03a9f4', dark: '#01579b' },
    secondary: { main: '#9c27b0', light: '#ba68c8', dark: '#7b1fa2' },
    // Extra colors used only by dashboard charts
    chart: {
      blue: '#2b8cbe',
      lightBlue: '#3498db',
      neutral: 'grey',
      dark: 'black',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  // Background of the login / register / password pages (any CSS background,
  // e.g. a gradient). Not a palette color: MUI 9 only accepts real colors there.
  authBackground: 'linear-gradient(to bottom right, #fff, #fff)',
  // Custom (non-MUI) values used by the app layout
  layout: {
    sidebarWidth: 240,
    sidebarMiniWidth: 70,
  },
});

export default theme;

// Tell TypeScript about the custom theme values above.
declare module '@mui/material/styles' {
  interface Palette {
    chart: { blue: string; lightBlue: string; neutral: string; dark: string };
  }
  interface PaletteOptions {
    chart?: Partial<Palette['chart']>;
  }
  interface Theme {
    authBackground: string;
    layout: { sidebarWidth: number; sidebarMiniWidth: number };
  }
  interface ThemeOptions {
    authBackground?: string;
    layout?: Partial<Theme['layout']>;
  }
}
