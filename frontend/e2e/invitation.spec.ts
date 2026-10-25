import { test, expect, login, adminProfile } from './fixtures';

// Invitations: the emailed link opens /invitation, the new user sets a password and is logged in.

const INVITATION = /^\/api\/auth\/invitation\/$/;
const ACCEPT = /^\/api\/auth\/invitation\/accept\/$/;
const LINK = '/invitation?uid=Mw&token=abc-123';

const bob = {
  ...adminProfile,
  uuid: 'profile-bob',
  type: 'Reporter',
  user: { ...adminProfile.user, id: 3, username: 'bob', first_name: 'Bob', email: 'bob@example.com' },
};

test('a valid link lets the new user set a password and opens the app', async ({ page, backend }) => {
  backend.json('GET', INVITATION, { username: 'bob', first_name: 'Bob', organization: 'Acme' });
  backend.on('POST', ACCEPT, (route) => {
    backend.loggedIn = true;
    backend.profile = bob;
    return route.fulfill({ json: { profile: bob } });
  });

  await page.goto(LINK);
  await expect(page.getByText(/Hello Bob, you are invited to/)).toBeVisible();
  await expect(page.getByText('Acme')).toBeVisible();
  expect(new URL(backend.calls(INVITATION, 'GET')[0].url()).searchParams.get('token')).toBe('abc-123');

  await page.locator('input[name="password"]').fill('First-Shift-Day-1');
  await page.locator('input[name="password2"]').fill('First-Shift-Day-1');
  await page.getByRole('button', { name: 'Set password and log in' }).click();

  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  expect(backend.calls(ACCEPT, 'POST')[0].postDataJSON()).toEqual({
    uid: 'Mw',
    token: 'abc-123',
    password: 'First-Shift-Day-1',
    password2: 'First-Shift-Day-1',
  });
});

test('a used or expired link says so', async ({ page, backend }) => {
  backend.json('GET', INVITATION, { non_field_errors: ['This invitation link is not valid any more.'] }, 400);
  await page.goto(LINK);
  await expect(page.getByText(/not valid any more\. Ask your administrator/)).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeHidden();
  // Said once, on the page (no extra error message).
  await expect(page.getByText(/Something wrong/)).toBeHidden();
});

test('a link without its token is not even checked', async ({ page, backend }) => {
  await page.goto('/invitation?uid=Mw');
  await expect(page.getByText(/not valid any more/)).toBeVisible();
  expect(backend.calls(INVITATION)).toHaveLength(0);
});

test('passwords are checked in the form and by the backend', async ({ page, backend }) => {
  backend.json('GET', INVITATION, { username: 'bob', first_name: 'Bob', organization: 'Acme' });
  backend.json('POST', ACCEPT, { password: ['This password is too common.'] }, 400);
  await page.goto(LINK);

  await page.locator('input[name="password"]').fill('secret-one');
  await page.locator('input[name="password2"]').fill('secret-two');
  await page.getByRole('button', { name: 'Set password and log in' }).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();
  expect(backend.calls(ACCEPT)).toHaveLength(0);

  await page.locator('input[name="password2"]').fill('secret-one');
  await page.getByRole('button', { name: 'Set password and log in' }).click();
  await expect(page.getByText(/This password is too common/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeHidden();
});

test('the users table shows invited users and can resend the invitation', async ({ page, backend }) => {
  backend.json('GET', /^\/api\/users\/$/, [adminProfile, { ...bob, invitation_pending: true }]);
  backend.json('POST', /^\/api\/users\/profile-bob\/resend-invitation\/$/, {
    detail: 'Invitation sent.',
  });

  await login(page);
  await page.getByRole('link', { name: 'Users' }).click();
  // Table rows are selectable (checkbox role), named after their cells.
  await expect(page.getByRole('checkbox', { name: 'bob bob@example.com Invited' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'admin admin@example.com Active' })).toBeVisible();

  await page.getByRole('rowheader', { name: 'bob' }).click();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Resend invitation' }).click();
  await expect(page.getByText('Invitation sent again')).toBeVisible();
  expect(backend.calls(/resend-invitation\/$/, 'POST')).toHaveLength(1);
});
