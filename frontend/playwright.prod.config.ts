import { defineConfig } from '@playwright/test';
import base, { PORT } from './playwright.config';

// Same tests, but against a production build (vite build + vite preview).
export default defineConfig({
  ...base,
  grepInvert: /@dev-only/,
  // Lets tests tell a production build from the dev server (React StrictMode).
  metadata: { build: 'production' },
  webServer: {
    ...base.webServer,
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
