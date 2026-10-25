import type { Page, WebSocketRoute } from '@playwright/test';
import { test, expect, login, adminProfile, sampleAssets, type Backend } from './fixtures';

// Operator view (Reporter users): line control over the 'machine-report' socket, and My Schedule.

const reporter = { ...adminProfile, type: 'Reporter' };
const EVENTS = /^\/api\/events\/$/;

/** Fake 'machine-report' socket; `report(state)` pushes a new line state to the page. */
async function fakeLine(page: Page) {
  const routes: WebSocketRoute[] = [];
  let current = 'off';
  await page.routeWebSocket(/\/ws\//, (route) => {
    if (!route.url().includes('/ws/machine-report/')) return;
    routes.push(route);
    route.send(message(current));
  });
  function message(state: string) {
    return JSON.stringify({ data: { uuid: 'e1', state, machine: sampleAssets[0] } });
  }
  return {
    routes,
    report(state: string) {
      current = state;
      for (const route of routes) route.send(message(state));
    },
  };
}

async function openControl(page: Page, backend: Backend) {
  backend.profile = reporter;
  backend.json('GET', /^\/api\/cells\/$/, [
    { uuid: 'c1', name: 'Pump cell', machine: sampleAssets[0] },
    { uuid: 'c2', name: 'Conveyor cell', machine: sampleAssets[1] },
  ]);
  backend.json('GET', /^\/api\/faults\/$/, [
    { uuid: 'f1', name: 'Pump jam', machine: sampleAssets[0] },
    { uuid: 'f2', name: 'Belt torn', machine: sampleAssets[1] },
  ]);
  backend.json('GET', /^\/api\/products\/$/, [{ uuid: 'p1', product_name: 'Bolt' }]);
  backend.json('POST', EVENTS, {}, 201);
  await login(page, '/operator/control');
}

const sentEvents = (backend: Backend) => backend.calls(EVENTS, 'POST').map((r) => r.postDataJSON());
const actionButton = (page: Page, name: string) =>
  page.getByRole('main').getByRole('button', { name, exact: true });

test('the buttons follow the line state', async ({ page, backend }) => {
  const line = await fakeLine(page);
  await openControl(page, backend);

  await expect(page.getByRole('button', { name: 'Machine state' })).toHaveText('Machine state: off');
  await expect(actionButton(page, 'On')).toBeVisible();
  await expect(actionButton(page, 'Out of order')).toBeVisible();
  await expect(actionButton(page, 'Run')).toBeHidden();

  line.report('on');
  await expect(page.getByRole('button', { name: 'Machine state' })).toHaveText('Machine state: on');
  for (const name of ['Run', 'Failure', 'Off']) await expect(actionButton(page, name)).toBeVisible();
  await expect(actionButton(page, 'On')).toBeHidden();

  line.report('run');
  for (const name of ['Stop', 'Report', 'Fault']) await expect(actionButton(page, name)).toBeVisible();
});

test('a button sends the new state for the chosen line', async ({ page, backend }) => {
  await fakeLine(page);
  await openControl(page, backend);
  await actionButton(page, 'On').click();

  await expect.poll(() => sentEvents(backend)).toEqual([{ machine: 'a1', state: 'on' }]);
  await expect(page.getByText('updated')).toBeVisible();
});

test('a fault must be reported, with the cells and faults of this line', async ({ page, backend }) => {
  const line = await fakeLine(page);
  await openControl(page, backend);
  line.report('fault');

  const dialog = page.getByRole('dialog', { name: 'Report' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeHidden();

  await dialog.getByRole('combobox', { name: 'Cell' }).click();
  await expect(page.getByRole('option')).toHaveText(['Pump cell']);
  await page.getByRole('option', { name: 'Pump cell' }).click();
  await dialog.getByRole('combobox', { name: 'Fault' }).click();
  await expect(page.getByRole('option')).toHaveText(['Pump jam']);
  await page.getByRole('option', { name: 'Pump jam' }).click();
  await dialog.getByRole('button', { name: 'Report' }).click();

  await expect
    .poll(() => sentEvents(backend))
    .toEqual([{ machine: 'a1', state: 'resume fault', cell: 'c1', fault: 'f1', quantity: 0, scrap: 0 }]);
  // The dialog closes once the line reports the new state.
  line.report('resume fault');
  await expect(dialog).toBeHidden();
});

test('production is reported with numbers, and the report can be cancelled', async ({ page, backend }) => {
  const line = await fakeLine(page);
  await openControl(page, backend);
  line.report('run');

  await actionButton(page, 'Report').click();
  const dialog = page.getByRole('dialog', { name: 'Report' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  await actionButton(page, 'Report').click();
  await dialog.getByRole('combobox', { name: 'Product' }).click();
  await page.getByRole('option', { name: 'Bolt' }).click();
  await dialog.getByLabel('Quantity produced').fill('25');
  await dialog.getByLabel('Scrap produced').fill('2');
  await dialog.getByRole('button', { name: 'Report' }).click();

  await expect
    .poll(() => sentEvents(backend))
    .toEqual([{ machine: 'a1', state: 'report', product: 'p1', quantity: 25, scrap: 2 }]);
  await expect(dialog).toBeHidden();
});

test('the chosen line is remembered and its state is followed', async ({ page, backend }) => {
  const line = await fakeLine(page);
  await openControl(page, backend);
  await page.getByRole('combobox', { name: 'Line' }).click();
  await page.getByRole('option', { name: 'Conveyor' }).click();

  await expect
    .poll(() => line.routes.filter((r) => r.url().includes('machine=a2')).length)
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('asset_uuid'))).toBe('a2');
});

test('starting a maintenance saves the current time and reloads the schedule', async ({ page, backend }) => {
  const plan = {
    uuid: 'plan-1',
    name: 'Oil change',
    ref: 'M-1',
    type: 'Planned',
    priority: 'Medium',
    status: 'Pending',
    asset: sampleAssets[0],
    assigned_to: { id: 1, username: 'admin' },
    created_by: { id: 1, username: 'admin' },
    planned_starting_date: new Date().toISOString(),
    planned_finished: new Date(Date.now() + 3600_000).toISOString(),
  };
  backend.profile = reporter;
  backend.json('GET', /^\/api\/maintenance-plans\/mine\/$/, [plan]);
  backend.json('PATCH', /^\/api\/maintenance-plans\/plan-1\/$/, plan);
  await login(page, '/operator/agenda');

  await page.getByText('Oil change').first().click();
  const loads = backend.calls(/^\/api\/maintenance-plans\/mine\/$/, 'GET').length;
  const clicked = Date.now();
  await page.getByRole('button', { name: 'Start' }).click();

  await expect.poll(() => backend.calls(/^\/api\/maintenance-plans\/plan-1\/$/, 'PATCH').length).toBe(1);
  const body = backend.calls(/^\/api\/maintenance-plans\/plan-1\/$/, 'PATCH')[0].postData() ?? '';
  expect(body).toContain('In Progress');
  const startedAt = /name="started_at"\r\n\r\n([^\r]+)/.exec(body)?.[1];
  // The click time, not two hours later.
  expect(Math.abs(new Date(startedAt!).getTime() - clicked)).toBeLessThan(60_000);
  await expect(page.getByText('Maintenance updated')).toBeVisible();
  await expect.poll(() => backend.calls(/^\/api\/maintenance-plans\/mine\/$/, 'GET').length).toBe(loads + 1);
});

test('the Home breadcrumb of My Schedule stays in the app', async ({ page, backend }) => {
  backend.profile = reporter;
  await login(page, '/operator/agenda');
  await page.getByLabel('breadcrumb').getByRole('link', { name: 'Home' }).click();
  // Still logged in: a full page reload would show the login page.
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Line' })).toBeVisible();
});
