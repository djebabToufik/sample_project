import type { Page } from '@playwright/test';
import { test, expect, login, type Backend } from './fixtures';

// OEE, Downtimes and Energy dashboards: the shared line / period filter and /api/downtime/.

const summary = (oee: number) => ({
  availability: 0.9,
  performance: 0.8,
  quality: 1,
  oee,
  machine_on_duration: 2,
  machine_run_duration: 1.5,
  machine_break_in_duration: 0.1,
  machine_break_out_duration: 0,
  machine_failure_duration: 0.25,
  machine_fault_duration: 0.5,
  out_of_order_duration: 0,
});

const downtime = {
  oee_selected_period: summary(72),
  oee_last_24h: summary(70),
  machine: { uuid: 'a3', name: 'Mixer' },
  downtime_per_fault: [],
  downtime_per_cell: [],
};

const DOWNTIME = /^\/api\/downtime\/$/;
// ISO dates with time zone (UTC), read right by the backend whatever its time zone.
const BACKEND_DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

function downtimeCalls(backend: Backend) {
  return backend.calls(DOWNTIME, 'GET').map((r) => Object.fromEntries(new URL(r.url()).searchParams));
}

const hoursBetween = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;

async function openOee(page: Page, backend: Backend) {
  backend.json('GET', DOWNTIME, downtime);
  await login(page, '/dashboards/oee');
  await expect(page.getByLabel('Total run time')).toContainText('1 hour(s) and 30 minutes');
}

test('a line card on the Live page opens the OEE of that line', async ({ page, backend }) => {
  backend.json('GET', DOWNTIME, downtime);
  await login(page);
  await page.getByRole('link', { name: 'Live', exact: true }).click();
  await page.getByLabel('Line Mixer').getByRole('link', { name: 'OEE' }).click();

  await expect(page.getByLabel('Total run time')).toContainText('1 hour(s) and 30 minutes');
  // Changes against the last 24 hours, all in percentage points (OEE 72 % vs 70 %).
  await expect(page.getByLabel('OEE', { exact: true })).toContainText('+2.0 pts');
  await expect(page.getByLabel('Availability', { exact: true })).toContainText('0.0 pts');
  await expect(page.getByLabel('Overall OEE', { exact: true })).toContainText('72.0 %');
  const [call] = downtimeCalls(backend);
  expect(call.machine).toBe('a3');
  expect(call.created_at__gte).toMatch(BACKEND_DATE);
  expect(call.created_at__lte).toMatch(BACKEND_DATE);
  // Default period: the last day, until one hour from now.
  expect(hoursBetween(call.created_at__gte, call.created_at__lte)).toBeCloseTo(25, 1);
});

test('an idle line shows no data instead of an OEE', async ({ page, backend }) => {
  const idle = { ...summary(0), availability: null, performance: null, quality: null, oee: null };
  backend.json('GET', DOWNTIME, { ...downtime, oee_selected_period: idle });
  await login(page, '/dashboards/oee');

  await expect(page.getByLabel('Overall OEE', { exact: true })).toContainText('No data');
  await expect(page.getByLabel('OEE', { exact: true })).toContainText('–');
  await expect(page.getByLabel('Availability', { exact: true })).toContainText('–');
});

test('choosing another line reloads and is remembered', async ({ page, backend }) => {
  await openOee(page, backend);
  await page.getByRole('combobox', { name: 'Line' }).click();
  await page.getByRole('option', { name: 'Conveyor' }).click();

  await expect.poll(() => downtimeCalls(backend).at(-1)?.machine).toBe('a2');
  expect(await page.evaluate(() => localStorage.getItem('asset_uuid'))).toBe('a2');
});

test('the quick periods change the time window and are remembered', async ({ page, backend }) => {
  await openOee(page, backend);
  await page.getByRole('button', { name: 'Last week' }).click();

  await expect.poll(() => downtimeCalls(backend).length).toBe(2);
  const call = downtimeCalls(backend)[1];
  // 7 calendar days back (one hour more or less across a daylight saving change) to one hour ahead.
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const expected = (Date.now() - weekAgo.getTime()) / 3_600_000 + 1;
  expect(hoursBetween(call.created_at__gte, call.created_at__lte)).toBeCloseTo(expected, 0);
  await expect(page.getByRole('button', { name: 'Last week' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Last hour' })).toBeEnabled();
  expect(await page.evaluate(() => [localStorage.prefered_period, localStorage.prefered_scale])).toEqual([
    '7',
    'd',
  ]);
});

test.describe('in a time zone other than the server', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('a custom date range is typed in local time, sent in UTC, and Refresh keeps it', async ({
    page,
    backend,
  }) => {
    await openOee(page, backend);
    await page.getByRole('button', { name: 'Show date filter' }).click();
    await page.getByLabel('From', { exact: true }).fill('2026-01-05T08:00');
    await page.getByLabel('To', { exact: true }).fill('2026-01-05T16:30');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();

    // 08:00 in New York (winter, UTC-5) = 13:00 UTC.
    const custom = {
      created_at__gte: '2026-01-05T13:00:00.000Z',
      created_at__lte: '2026-01-05T21:30:00.000Z',
    };
    await expect.poll(() => downtimeCalls(backend).at(-1)).toMatchObject(custom);
    // Shown in local time again (the browser drops zero seconds).
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-01-05T08:00');
    // No quick period is selected any more.
    await expect(page.getByRole('button', { name: 'Last hour' })).toBeEnabled();

    const before = downtimeCalls(backend).length;
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect.poll(() => downtimeCalls(backend).length).toBe(before + 1);
    expect(downtimeCalls(backend).at(-1)).toMatchObject(custom);
  });
});

test('Refresh with a quick period moves the window up to now', async ({ page, backend }) => {
  await openOee(page, backend);
  const first = downtimeCalls(backend)[0];
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Refresh' }).click();

  await expect.poll(() => downtimeCalls(backend).length).toBe(2);
  const second = downtimeCalls(backend)[1];
  expect(second.created_at__lte > first.created_at__lte).toBe(true);
});

test('the downtimes page charts the counts sent by the backend', async ({ page, backend }) => {
  backend.json('GET', DOWNTIME, {
    ...downtime,
    downtime_per_fault: [
      { uuid: 'f1', name: 'Jam', count: 3 },
      { uuid: 'f2', name: 'Overheat', count: 1 },
    ],
    downtime_per_cell: [{ uuid: 'c1', name: 'Cell A', count: 2 }],
  });
  await login(page, '/dashboards/downtimes');

  const perFault = page.getByLabel('Per fault type');
  await expect(perFault).toContainText('Jam');
  await expect(perFault).toContainText('Overheat');
  await expect(page.getByLabel('Per cell')).toContainText('Cell A');
  // Bar heights follow the counts (3 : 1).
  const bars = perFault.locator('.MuiBarChart-element');
  await expect(bars).toHaveCount(2);
  const [jam, overheat] = await bars.evaluateAll((rects) =>
    rects.map((r) => r.getBoundingClientRect().height),
  );
  expect(jam / overheat).toBeCloseTo(3, 1);
});

test('OEE, Downtimes and Energy share the loaded data for the same filter', async ({ page, backend }) => {
  backend.json('GET', DOWNTIME, downtime);
  await login(page);
  await page.getByRole('link', { name: 'Live', exact: true }).click();
  await page.getByLabel('Line Pump').getByRole('link', { name: 'OEE' }).click();
  await expect(page.getByLabel('Total run time')).toContainText('1 hour(s) and 30 minutes');

  await page.getByRole('link', { name: 'Live', exact: true }).click();
  await page.getByLabel('Line Pump').getByRole('link', { name: 'Downtimes' }).click();
  await expect(page.getByLabel('Fault time', { exact: true })).toContainText('30 minute(s)');

  expect(downtimeCalls(backend)).toHaveLength(1);
});

test('shows a hint when no line exists yet', async ({ page, backend }) => {
  backend.json('GET', /^\/api\/assets\/$/, []);
  await login(page, '/dashboards/oee');
  await expect(page.getByText(/You have no line created/)).toHaveCount(1);
  expect(downtimeCalls(backend)).toHaveLength(0);
});

test('energy and costs pages compute from the line rates', async ({ page, backend }) => {
  const machine = {
    uuid: 'a1',
    name: 'Pump',
    running_hour_consumption_kw: 10,
    on_hour_consumption_kw: 4,
    running_hour_cost: 20,
    on_hour_cost: 8,
  };
  backend.json('GET', DOWNTIME, { ...downtime, machine });
  await login(page, '/dashboards/energy');

  // run 1.5 h, on 2 h, fault 0.5 h, failure 0.25 h:
  // faulty = 10*0.5 + 4*0.25 = 6, run = 10*1.5 - 5 = 10, on = 4*0.5 - 1 = 1, total = 17
  await expect(page.getByLabel('Total Energy consumption')).toContainText('17.00 Kw');
  await expect(page.getByLabel('Run energy')).toContainText('10.00 Kw');
  await expect(page.getByLabel('Failures energy')).toContainText('6.00 Kw');
  await expect(page.getByLabel('Total Costs')).toContainText('34.00 $');

  // Cards fit inside their columns.
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
