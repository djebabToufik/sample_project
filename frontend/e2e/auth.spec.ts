import type { Page } from '@playwright/test';
import { test, expect, login, CSRF_TOKEN } from './fixtures';
import brand from '../src/branding/brand';

test('shows the login page when nobody is logged in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Enter your username')).toBeVisible();
  await expect(page.getByText('Enter your password')).toBeVisible();
  await expect(page).toHaveTitle(brand.title);
});

test('logs in, shows the app, and logs out again on the backend', async ({ page, backend }) => {
  await login(page);
  await expect(page.getByText(brand.appName)).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(page.getByText('Enter your username')).toBeVisible();
  await expect.poll(() => backend.calls(/^\/api\/auth\/logout\/$/, 'POST').length).toBe(1);

  // The backend session is gone: a reload stays on the login page.
  await page.reload();
  await expect(page.getByText('Enter your username')).toBeVisible();
});

test('a reload keeps the user logged in (session on the backend)', async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  await expect(page.getByText('Enter your username')).toBeHidden();
});

test('wrong credentials keep the user on the login page', async ({ page, backend }) => {
  backend.json('POST', /^\/api\/auth\/login\/$/, { detail: 'Username or password are wrong' }, 400);
  await page.goto('/');
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText(/Username or password are wrong/)).toBeVisible();
});

test('changes carry the CSRF header; no token is sent anywhere', async ({ page, backend }) => {
  await login(page);
  await expect.poll(() => backend.calls(/^\/api\/assets\/$/, 'GET').length).toBeGreaterThan(0);

  const loginCall = backend.calls(/^\/api\/auth\/login\/$/, 'POST')[0];
  expect(await loginCall.headerValue('x-csrftoken')).toBe(CSRF_TOKEN);
  for (const request of backend.requests) {
    expect(await request.headerValue('authorization')).toBeNull();
  }

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect.poll(() => backend.calls(/^\/api\/auth\/logout\/$/, 'POST').length).toBe(1);
  const logoutCall = backend.calls(/^\/api\/auth\/logout\/$/, 'POST')[0];
  expect(await logoutCall.headerValue('x-csrftoken')).toBe(CSRF_TOKEN);
});

// Log in and wait until the start page has loaded its assets, so a later
// handler change only affects the requests the test triggers itself.
async function loginAndSettle(page: Page) {
  const dashboardLoaded = page.waitForResponse((r) => r.url().endsWith('/api/assets/'));
  await login(page);
  await dashboardLoaded;
}

test('an ended session (401) sends the user back to the login page', async ({ page, backend }) => {
  await loginAndSettle(page);
  backend.json('GET', /^\/api\/assets\/$/, { detail: 'Authentication credentials were not provided.' }, 401);
  await page.getByRole('link', { name: 'Lines' }).click();
  await expect(page.getByText('Enter your username')).toBeVisible();
});

test('a 403 (not allowed) does not log the user out', async ({ page, backend }) => {
  await loginAndSettle(page);
  backend.json('GET', /^\/api\/assets\/$/, { detail: 'Not allowed.' }, 403);
  await page.getByRole('link', { name: 'Lines' }).click();
  // One toast container for the whole app, and one request per list (also in dev,
  // where React StrictMode mounts pages twice): the message is shown exactly once.
  await expect(page.getByText(/Something wrong/)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
});
