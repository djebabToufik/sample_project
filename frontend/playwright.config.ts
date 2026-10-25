import { defineConfig, devices } from '@playwright/test';

// Browser tests for the frontend.
// The backend is faked per test (e2e/fixtures.ts), so no Docker or database is needed.
export const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // The dev server compiles each page area on first use; with many tests in parallel that can
  // take several seconds, so assertions wait up to 10 s (default 5 s).
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // playwright.prod.config.ts runs the same tests against a production build.
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
