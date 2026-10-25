import { test, expect, login, sampleAssets } from './fixtures';

// CMMS dashboards: numbers come from the shared lists (src/data/), which are cached between pages.

test('the start page counts the assets', async ({ page }) => {
  await login(page);
  // sampleAssets: 3 assets, Mixer under maintenance, Conveyor's warranty ended in 2020.
  await expect(page.getByLabel('All assets')).toContainText('3');
  await expect(page.getByLabel('Asset in maintenance')).toContainText('1');
  await expect(page.getByLabel('Asset out of warranty')).toContainText('1');
  await expect(page.getByLabel('Retired assets').first()).toContainText('0');
});

test('Lines shows the cached assets at once and refreshes them', async ({ page, backend }) => {
  await login(page);
  await expect(page.getByLabel('Asset in maintenance')).toContainText('1');

  // The refresh of the list answers late, with one more asset.
  let answer!: () => void;
  const released = new Promise<void>((resolve) => (answer = resolve));
  backend.on('GET', /^\/api\/assets\/$/, async (route) => {
    await released;
    await route.fulfill({ json: [...sampleAssets, { ...sampleAssets[0], uuid: 'a4', name: 'Lathe' }] });
  });

  await page.getByRole('link', { name: 'Lines' }).click();
  await expect(page.getByRole('rowheader', { name: 'Pump' })).toBeVisible();
  await expect(page.getByTestId('page-loading')).toBeHidden();

  answer();
  await expect(page.getByRole('rowheader', { name: 'Lathe' })).toBeVisible();
});

test('the maintenance dashboard handles plans without an asset', async ({ page, backend }) => {
  const plan = (uuid: string, status: string, asset: unknown) => ({
    uuid,
    name: uuid,
    ref: uuid,
    type: 'Planned',
    priority: 'Medium',
    status,
    asset,
    assigned_to: { id: 1, username: 'admin' },
    created_by: { id: 1, username: 'admin' },
    planned_starting_date: null,
    planned_finished: null,
  });
  backend.json('GET', /^\/api\/maintenance-plans\/$/, [
    plan('m1', 'Pending', sampleAssets[0]),
    plan('m2', 'Pending', null),
    plan('m3', 'Completed', sampleAssets[1]),
  ]);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await login(page);
  await page.getByRole('link', { name: 'Maintenances', exact: true }).click();
  await expect(page.getByLabel('Pending maintenances')).toContainText('2');
  await expect(page.getByLabel('Completed maintenances')).toContainText('1');
  await expect(page.getByLabel('Maintenance per asset')).toBeVisible();
  expect(errors).toEqual([]);
});

test('dashboard cards fit inside their grid columns', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await login(page);
  await expect(page.getByLabel('All assets')).toContainText('3');

  // A card wider than its column runs into the window edge (no right padding).
  const overflowing = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.MuiGrid-root > .MuiPaper-root')]
      .filter(
        (card) =>
          card.getBoundingClientRect().right > card.parentElement!.getBoundingClientRect().right + 0.5,
      )
      .map((card) => card.getAttribute('aria-label')),
  );
  expect(overflowing).toEqual([]);
});
