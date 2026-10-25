import { test, expect, login, adminProfile, sampleAssets, type Backend } from './fixtures';
import type { Page } from '@playwright/test';

// The shared DataTable, tested through the Assets ("Lines") and Users pages.

const firstColumn = (page: Page) => page.getByRole('rowheader').allInnerTexts();

async function openAssets(page: Page) {
  await login(page);
  await page.getByRole('link', { name: 'Lines' }).click();
  await expect(page.getByRole('rowheader', { name: 'Pump' })).toBeVisible();
}

test('lists rows in backend order until a column is sorted', async ({ page }) => {
  await openAssets(page);
  expect(await firstColumn(page)).toEqual(['Pump', 'Conveyor', 'Mixer']);

  await page.getByRole('button', { name: 'Asset name' }).click();
  expect(await firstColumn(page)).toEqual(['Conveyor', 'Mixer', 'Pump']);

  await page.getByRole('button', { name: 'Asset name' }).click();
  expect(await firstColumn(page)).toEqual(['Pump', 'Mixer', 'Conveyor']);
});

test('sorts the warranty column by date', async ({ page }) => {
  await openAssets(page);
  await page.getByRole('button', { name: 'End of warranty' }).click();
  // 2020 (Conveyor), 2028 (Mixer), 2030 (Pump)
  expect(await firstColumn(page)).toEqual(['Conveyor', 'Mixer', 'Pump']);
});

test('toolbar actions follow the selection', async ({ page }) => {
  await openAssets(page);
  await expect(page.getByRole('button', { name: 'Add new assets' })).toBeVisible();

  await page.getByRole('rowheader', { name: 'Pump' }).click();
  await expect(page.getByText('1 selected')).toBeVisible();
  for (const name of ['View', 'Edit', 'Delete']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }

  await page.getByRole('rowheader', { name: 'Mixer' }).click();
  await expect(page.getByText('2 selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
});

test('deletes the selected rows and clears the selection', async ({ page, backend }) => {
  backend.json('DELETE', /^\/api\/assets\/a\d\/$/, {}, 204);
  await openAssets(page);

  await page.getByRole('rowheader', { name: 'Pump' }).click();
  await page.getByRole('rowheader', { name: 'Mixer' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, I am sure!' }).click();

  await expect.poll(() => deletedIds(backend)).toEqual(['a1', 'a3']);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('2 selected')).toBeHidden();
});

function deletedIds(backend: Backend) {
  return backend
    .calls(/^\/api\/assets\/a\d\/$/, 'DELETE')
    .map((r) => new URL(r.url()).pathname.split('/').at(-2))
    .sort();
}

test('users table sorts by username (nested user data)', async ({ page, backend }) => {
  const user = (id: number, username: string) => ({
    ...adminProfile,
    uuid: `profile-${id}`,
    user: { ...adminProfile.user, id, username, email: `${username}@example.com` },
  });
  backend.json('GET', /^\/api\/users\/$/, [user(1, 'zoe'), user(2, 'adam'), user(3, 'mia')]);

  await login(page);
  await page.getByRole('link', { name: 'Users' }).click();
  await expect(page.getByRole('rowheader', { name: 'adam' })).toBeVisible();
  expect(await firstColumn(page)).toEqual(['adam', 'mia', 'zoe']);

  await page.getByRole('rowheader', { name: 'mia' }).click();
  await expect(page.getByRole('button', { name: 'View', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeHidden();
});

test('products table has the right title', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Products' }).click();
  await expect(page.getByRole('table', { name: 'Products table' })).toBeVisible();
});

test('cancelling the delete confirmation keeps the selection', async ({ page, backend }) => {
  await openAssets(page);
  await page.getByRole('rowheader', { name: 'Pump' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('You have selected 1 assets to delete')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByText('1 selected')).toBeVisible();
  expect(backend.calls(/^\/api\/assets\/a\d\/$/, 'DELETE')).toHaveLength(0);
});

test('the success message waits until every delete has finished', async ({ page, backend }) => {
  let finish!: () => void;
  const deletesDone = new Promise<void>((resolve) => (finish = resolve));
  backend.on('DELETE', /^\/api\/assets\/a\d\/$/, async (route) => {
    await deletesDone;
    await route.fulfill({ status: 204 });
  });
  await openAssets(page);

  await page.getByRole('rowheader', { name: 'Pump' }).click();
  await page.getByRole('rowheader', { name: 'Mixer' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, I am sure!' }).click();

  await expect.poll(() => deletedIds(backend)).toEqual(['a1', 'a3']);
  await page.waitForTimeout(300);
  await expect(page.getByText('Assets deleted')).toBeHidden();

  finish();
  await expect(page.getByText('Assets deleted')).toBeVisible();
});

test('reports deletes that failed', async ({ page, backend }) => {
  backend.json('DELETE', /^\/api\/assets\/a1\/$/, {}, 204);
  backend.json('DELETE', /^\/api\/assets\/a3\/$/, { detail: 'Not allowed.' }, 403);
  await openAssets(page);

  await page.getByRole('rowheader', { name: 'Pump' }).click();
  await page.getByRole('rowheader', { name: 'Mixer' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, I am sure!' }).click();

  await expect(page.getByText('1 of 2 could not be deleted. Hint: Not allowed.')).toBeVisible();
  await expect(page.getByText('Assets deleted')).toBeHidden();
});

test('a page loads its list once and reloads it after a delete', async ({ page, backend }) => {
  backend.json('DELETE', /^\/api\/assets\/a\d\/$/, {}, 204);
  await login(page);
  await page.waitForLoadState('networkidle');
  const assetLoads = () => backend.calls(/^\/api\/assets\/$/, 'GET').length;
  const before = assetLoads();

  await page.getByRole('link', { name: 'Lines' }).click();
  await expect(page.getByRole('rowheader', { name: 'Pump' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(assetLoads()).toBe(before + 1);

  await page.getByRole('rowheader', { name: 'Pump' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, I am sure!' }).click();
  await expect(page.getByText('Assets deleted')).toBeVisible();
  await expect.poll(assetLoads).toBe(before + 2);
});

test('logging out forgets the loaded lists', async ({ page, backend }) => {
  await openAssets(page);
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();

  // The next user has one asset, and the list arrives late:
  // the previous user's 3 assets must not show meanwhile.
  let answer!: () => void;
  const released = new Promise<void>((resolve) => (answer = resolve));
  backend.on('GET', /^\/api\/assets\/$/, async (route) => {
    await released;
    await route.fulfill({ json: [{ ...sampleAssets[0], uuid: 'b1', name: 'Lathe' }] });
  });
  await login(page);
  await expect(page.getByTestId('page-loading')).toBeVisible();
  await expect(page.getByLabel('All assets')).toContainText('0');

  answer();
  await expect(page.getByLabel('All assets')).toContainText('1');
  await page.getByRole('link', { name: 'Lines' }).click();
  await expect(page.getByRole('rowheader', { name: 'Lathe' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Pump' })).toBeHidden();
});

test('an asset without a photo shows the brand placeholder', async ({ page }) => {
  await openAssets(page);
  await page.getByRole('rowheader', { name: 'Pump' }).click();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const photo = page.getByRole('img', { name: 'Pump' });
  await expect(photo).toHaveAttribute('src', '/asset-placeholder.svg');
  // The file exists and is an image.
  expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('deleting an asset with maintenance plans explains why it failed', async ({ page, backend }) => {
  const detail =
    'This asset has maintenance plans. Retire it instead (status Retired), or delete its plans first.';
  backend.json('DELETE', /^\/api\/assets\/a1\/$/, { detail }, 400);
  await openAssets(page);
  await page.getByRole('rowheader', { name: 'Pump' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, I am sure!' }).click();
  await expect(page.getByText(`1 of 1 could not be deleted. Hint: ${detail}`)).toBeVisible();
});
