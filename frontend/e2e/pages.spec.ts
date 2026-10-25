import type { Page } from '@playwright/test';
import { test, expect, login, adminProfile, sampleAssets } from './fixtures';

// Smoke test: every page renders without JavaScript errors or React/MUI console errors.
// Catches library upgrades that break pages the feature tests do not visit.

const plan = {
  uuid: 'plan-1',
  name: 'Oil change',
  ref: 'M-1',
  type: 'Planned',
  priority: 'Medium',
  status: 'In Progress',
  assigned_to: { id: 1, username: 'admin' },
  created_by: { id: 1, username: 'admin' },
  asset: sampleAssets[0],
  planned_starting_date: new Date().toISOString(),
  planned_finished: new Date(Date.now() + 3600_000).toISOString(),
};

// The live dashboards open WebSockets to the backend, which does not exist in these tests.
// The app also logs its own message when such a socket closes.
const ignored = [/WebSocket/i, /ws:\/\//i, /Failed to load resource/i, /socket closed unexpectedly/i];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!ignored.some((pattern) => pattern.test(text))) errors.push(`console: ${text}`);
  });
  return errors;
}

const adminPages = [
  'Live',
  'OEE',
  'Downtimes',
  'Energy & costs',
  'Assets',
  'Maintenances',
  'Agenda',
  'Maintenance plans',
  'Lines',
  'Cells',
  'Faults',
  'Products',
  'Users',
];

for (const name of adminPages) {
  test(`admin page "${name}" renders without errors`, async ({ page, backend }) => {
    backend.json('GET', /^\/api\/maintenance-plans\/$/, [plan]);
    const errors = collectErrors(page);
    await login(page);
    await page.getByRole('link', { name, exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

// Operator pages keep reconnecting a WebSocket, so they never reach "network idle":
// wait for the page content instead.
test('operator (Reporter) pages render without errors', async ({ page, backend }) => {
  backend.profile = { ...adminProfile, type: 'Reporter' };
  backend.json('GET', /^\/api\/maintenance-plans\/mine\/$/, [plan]);
  const errors = collectErrors(page);

  await login(page, '/operator/control');
  await page.getByRole('link', { name: 'My Schedule' }).click();
  await expect(page.getByTestId('maintenance-calendar')).toBeVisible();
  await expect(page.getByText('Oil change').first()).toBeVisible();
  await page.getByRole('link', { name: 'Control' }).click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

for (const path of ['/register', '/password-reset-email', '/password-change']) {
  test(`public page ${path} renders without errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
}
