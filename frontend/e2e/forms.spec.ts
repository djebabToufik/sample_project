import type { Page, Request } from '@playwright/test';
import { test, expect, login, sampleAssets, type Backend } from './fixtures';

// Admin add / edit forms: checks, the request they send, and dates in the user's time zone.

/** Fields of a multipart form request, as name -> value (files as their file name). */
function formFields(request: Request): Record<string, string> {
  const body = request.postDataBuffer()?.toString('latin1') ?? '';
  const fields: Record<string, string> = {};
  for (const part of body.split(/--[^\r\n]+\r\n/)) {
    const name = /name="([^"]+)"(?:; filename="([^"]*)")?/.exec(part);
    if (!name) continue;
    const value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
    fields[name[1]] = name[2] ?? value;
  }
  return fields;
}

const lastCall = (backend: Backend, path: RegExp, method: string) => backend.calls(path, method).at(-1)!;

async function openPage(page: Page, link: string, table: string) {
  await login(page);
  await page.getByRole('link', { name: link, exact: true }).click();
  await expect(page.getByRole('table', { name: `${table} table` })).toBeVisible();
}

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label).click();
  await page.getByRole('option', { name: option }).click();
}

test('a new cell needs a name and a machine, then is created', async ({ page, backend }) => {
  backend.json('POST', /^\/api\/cells\/$/, {}, 201);
  await openPage(page, 'Cells', 'Cells');
  const loads = backend.calls(/^\/api\/cells\/$/, 'GET').length;

  await page.getByRole('button', { name: 'Add new cells' }).click();
  const form = page.getByRole('form', { name: 'New Cell' });
  await form.getByRole('button', { name: 'Create' }).click();
  await expect(form.getByText('Required')).toHaveCount(2);
  expect(backend.calls(/^\/api\/cells\/$/, 'POST')).toHaveLength(0);

  await form.getByLabel('Cell Name').fill('Station 1');
  await choose(page, 'Assigned Machine', 'Mixer');
  await form.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('Cell created')).toBeVisible();
  expect(formFields(lastCall(backend, /^\/api\/cells\/$/, 'POST'))).toEqual({
    name: 'Station 1',
    machine: 'a3',
  });
  await expect(form).toBeHidden();
  await expect.poll(() => backend.calls(/^\/api\/cells\/$/, 'GET').length).toBe(loads + 1);
});

test('a form starts empty again after it was closed', async ({ page }) => {
  await openPage(page, 'Cells', 'Cells');
  await page.getByRole('button', { name: 'Add new cells' }).click();
  await page.getByLabel('Cell Name').fill('Draft');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Add new cells' }).click();
  await expect(page.getByLabel('Cell Name')).toHaveValue('');
});

test('editing a product sends a PATCH with its values', async ({ page, backend }) => {
  backend.json('GET', /^\/api\/products\/$/, [
    {
      uuid: 'p1',
      product_name: 'Bolt',
      product_id: 'B-1',
      ideal_cycle: 12,
    },
  ]);
  backend.json('PATCH', /^\/api\/products\/p1\/$/, {});
  await openPage(page, 'Products', 'Products');
  await page.getByRole('rowheader', { name: 'Bolt' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();

  await expect(page.getByLabel('Ideal Cycle (seconds)')).toHaveValue('12');
  await page.getByLabel('Ideal Cycle (seconds)').fill('0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Must be more than 0')).toBeVisible();

  await page.getByLabel('Ideal Cycle (seconds)').fill('9.5');
  await page.getByLabel('Ideal Cycle (seconds)').press('Enter');
  await expect(page.getByText('Product updated')).toBeVisible();
  expect(formFields(lastCall(backend, /^\/api\/products\/p1\/$/, 'PATCH'))).toEqual({
    product_name: 'Bolt',
    product_id: 'B-1',
    ideal_cycle: '9.5',
  });
});

test('a photo over 2 MB is refused', async ({ page }) => {
  await openPage(page, 'Lines', 'Assets');
  await page.getByRole('button', { name: 'Add new assets' }).click();
  await page.getByLabel('Upload Photo').setInputFiles({
    name: 'big.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2_100_000),
  });
  await expect(page.getByText('The file is bigger than 2 MB')).toBeVisible();
  await expect(page.getByText('Selected: big.png')).toBeHidden();

  await page.getByLabel('Upload Photo').setInputFiles({
    name: 'small.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(1000),
  });
  await expect(page.getByText('Selected: small.png')).toBeVisible();
  await expect(page.getByText('The file is bigger than 2 MB')).toBeHidden();
});

test('the reason of a refused save is shown', async ({ page, backend }) => {
  backend.json(
    'POST',
    /^\/api\/assets\/$/,
    { serial_number: ['asset with this serial already exists.'] },
    400,
  );
  await openPage(page, 'Lines', 'Assets');
  await page.getByRole('button', { name: 'Add new assets' }).click();
  for (const [label, value] of [
    ['Name', 'Lathe'],
    ['Reference', 'L-1'],
    ['Serial Number', 'S1'],
    ['Location', 'Hall D'],
  ]) {
    await page.getByRole('textbox', { name: new RegExp(`^${label}`) }).fill(value);
  }
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(
    page.getByText('Something went wrong! serial_number: asset with this serial already exists.'),
  ).toBeVisible();
  // The form stays open with the values, so the user can fix them.
  await expect(page.getByLabel('Serial Number')).toHaveValue('S1');
});

test('inviting a user shows one lasting message', async ({ page, backend }) => {
  backend.json('POST', /^\/api\/users\/$/, {}, 201);
  await openPage(page, 'Users', 'Users');
  await page.getByRole('button', { name: 'Add new users' }).click();
  await page.getByLabel('First Name').fill('Grace');
  await page.getByLabel('Last Name').fill('Hopper');
  await page.getByLabel('Username').fill('grace');
  await page.getByLabel('Email Address').fill('grace@example');
  await choose(page, 'Role', 'Reporter');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(
    page.getByText('User invited. They get an email with a link to set their password.'),
  ).toBeVisible();
  await expect(page.getByText('User created', { exact: true })).toBeHidden();
  expect(formFields(lastCall(backend, /^\/api\/users\/$/, 'POST'))).toEqual({
    first_name: 'Grace',
    last_name: 'Hopper',
    username: 'grace',
    email: 'grace@example',
    type: 'Reporter',
  });
});

test.describe('in a time zone other than the server', () => {
  test.use({ timezoneId: 'America/New_York' });

  const plan = {
    uuid: 'plan-7',
    name: 'Oil change',
    ref: 'M-7',
    type: 'Planned',
    priority: 'Medium',
    status: 'Pending',
    assigned_to: { id: 1, username: 'admin' },
    created_by: { id: 1, username: 'admin' },
    asset: sampleAssets[0],
    // 10:00 in Berlin = 08:00 UTC = 04:00 in New York (summer time)
    planned_starting_date: '2026-07-20T10:00:00+02:00',
    planned_finished: '2026-07-20T12:00:00+02:00',
    started_at: null,
    finished_at: null,
  };

  test('plan dates are shown in local time and saved unchanged', async ({ page, backend }) => {
    backend.json('GET', /^\/api\/maintenance-plans\/$/, [plan]);
    backend.json('PATCH', /^\/api\/maintenance-plans\/plan-7\/$/, plan);
    await openPage(page, 'Maintenance plans', 'Maintenance planning');
    await page.getByRole('rowheader', { name: 'Oil change' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();

    await expect(page.getByLabel('Planned Start')).toHaveValue('2026-07-20T04:00');
    await expect(page.getByLabel('Planned Finish')).toHaveValue('2026-07-20T06:00');
    await expect(page.getByLabel('Actual Start')).toHaveValue('');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Maintenance Plan updated')).toBeVisible();
    const fields = formFields(lastCall(backend, /plan-7\/$/, 'PATCH'));
    expect(new Date(fields.planned_starting_date).toISOString()).toBe('2026-07-20T08:00:00.000Z');
    expect(new Date(fields.planned_finished).toISOString()).toBe('2026-07-20T10:00:00.000Z');
    expect(fields).not.toHaveProperty('started_at');
  });

  test('an asset without dates keeps them empty', async ({ page }) => {
    await openPage(page, 'Lines', 'Assets');
    await page.getByRole('rowheader', { name: 'Pump' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByLabel('Purchase Date')).toHaveValue('');
    await expect(page.getByLabel('Warranty Expiration Date')).toHaveValue('2029-12-31T19:00');
  });
});
