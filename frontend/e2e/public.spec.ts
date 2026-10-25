import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// Login and account pages (shown while logged out).

const LOGIN = /^\/api\/auth\/login\/$/;

async function fillLogin(page: Page) {
  await page.goto('/');
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill('secret');
}

/** Marks the current document; the mark is gone after a full page load. */
const markPage = (page: Page) => page.evaluate(() => ((window as unknown as { mark: boolean }).mark = true));
const isSamePage = (page: Page) =>
  page.evaluate(() => (window as unknown as { mark?: boolean }).mark === true);

test('Enter in the password field logs in', async ({ page, backend }) => {
  await fillLogin(page);
  await page.locator('input[name="password"]').press('Enter');
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  expect(backend.calls(LOGIN, 'POST')[0].postDataJSON()).toEqual({
    username: 'admin',
    password: 'secret',
  });
});

test('a server error is not reported as a wrong password', async ({ page, backend }) => {
  backend.json('POST', LOGIN, { detail: 'boom' }, 500);
  await fillLogin(page);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText(/server did not answer correctly/)).toBeVisible();
  await expect(page.getByText(/Username or password are wrong/)).toBeHidden();
});

test('an account without profile gets a clear message', async ({ page, backend }) => {
  backend.profile = null;
  await fillLogin(page);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText(/has no profile yet/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeHidden();
});

test('links between the account pages stay in the app', async ({ page }) => {
  await page.goto('/');
  await markPage(page);
  await page.getByRole('link', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible();
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Reset Password' }).click();
  await expect(page.getByRole('heading', { name: 'Password Reset' })).toBeVisible();
  expect(await isSamePage(page)).toBe(true);
});

test('register checks the form before sending it', async ({ page, backend }) => {
  backend.json('POST', /^\/api\/auth\/signup\/$/, {}, 201);
  await page.goto('/register');
  const form = page.getByRole('form', { name: 'Create Your Account' });
  await form.getByRole('button', { name: 'Register' }).click();
  await expect(form.getByText('Please enter a username')).toBeVisible();
  await expect(
    form.getByText('Please enter a valid email').or(form.getByText('Please enter your email')),
  ).toBeVisible();

  const fields = { username: 'ada', organization: 'Acme', email: 'ada@example.com', password: 'pw1' };
  for (const [name, value] of Object.entries(fields)) await form.locator(`input[name="${name}"]`).fill(value);
  await form.locator('input[name="password2"]').fill('other');
  await form.getByRole('button', { name: 'Register' }).click();
  await expect(form.getByText('Passwords do not match')).toBeVisible();
  expect(backend.calls(/^\/api\/auth\/signup\/$/, 'POST')).toHaveLength(0);

  await form.locator('input[name="password2"]').fill('pw1');
  await form.locator('input[name="password2"]').press('Enter');
  await expect(page.getByText('Account created. You can login now.')).toBeVisible();
  await expect(page.getByText('Enter your username')).toBeVisible();
  expect(backend.calls(/^\/api\/auth\/signup\/$/, 'POST')[0].postDataJSON()).toEqual({
    ...fields,
    password2: 'pw1',
  });
});

test('register shows the reason the backend gives', async ({ page, backend }) => {
  backend.json(
    'POST',
    /^\/api\/auth\/signup\/$/,
    { username: ['A user with that username already exists.'] },
    400,
  );
  await page.goto('/register');
  const form = page.getByRole('form', { name: 'Create Your Account' });
  for (const [name, value] of Object.entries({
    username: 'admin',
    organization: 'Acme',
    email: 'a@example.com',
    password: 'pw',
    password2: 'pw',
  })) {
    await form.locator(`input[name="${name}"]`).fill(value);
  }
  await form.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('Error: username: A user with that username already exists.')).toBeVisible();
});

test('password reset: email, then PIN and new password', async ({ page, backend }) => {
  backend.json('POST', /^\/api\/auth\/password-reset\/$/, { status: 'OK' });
  backend.json('POST', /^\/api\/auth\/password-reset\/confirm\/$/, { status: 'OK' });
  await page.goto('/password-reset-email');
  await page.locator('input[name="email"]').fill('ada@example.com');
  await page.getByRole('button', { name: 'Send Reset Email' }).click();

  await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible();
  expect(backend.calls(/password-reset\/$/, 'POST')[0].postDataJSON()).toEqual({ email: 'ada@example.com' });

  await page.locator('input[name="token"]').fill(' 123456 ');
  await page.locator('input[name="password"]').fill('new-pw');
  await page.locator('input[name="password2"]').fill('typo');
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();

  await page.locator('input[name="password2"]').fill('new-pw');
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page.getByText('Password changed. You can login now.')).toBeVisible();
  await expect(page.getByText('Enter your username')).toBeVisible();
  expect(backend.calls(/password-reset\/confirm\/$/, 'POST')[0].postDataJSON()).toEqual({
    token: '123456',
    password: 'new-pw',
  });
});

test('with sign-up closed there is no Register link, and the page says why', async ({ page, backend }) => {
  backend.json('GET', /^\/api\/auth\/settings\/$/, { signup: false });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Register' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Reset Password' }).click();
  await expect(page.getByRole('button', { name: 'Send Reset Email' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Register here' })).toHaveCount(0);

  await page.goto('/register');
  await expect(page.getByText('Sign-up is closed')).toBeVisible();
  await expect(page.getByLabel('Username')).toHaveCount(0);
});

test('a public demo shows its account on the login page and fills it in', async ({ page, backend }) => {
  backend.json('GET', /^\/api\/auth\/settings\/$/, {
    signup: false,
    demo: { username: 'demo', password: 'demo-pass' },
  });
  await page.goto('/');
  const hint = page.getByLabel('Demo account');
  await expect(hint).toContainText('username demo, password demo-pass');

  await hint.getByRole('button', { name: 'Fill in' }).click();
  await expect(page.locator('input[name="username"]')).toHaveValue('demo');
  await expect(page.locator('input[name="password"]')).toHaveValue('demo-pass');
});

test('without a demo account the login page shows no demo hint', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  await expect(page.getByLabel('Demo account')).toHaveCount(0);
});
