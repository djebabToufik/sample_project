import { test, expect, login, sampleAssets } from './fixtures';
import type { Page } from '@playwright/test';

const plan = {
  uuid: 'plan-42',
  name: 'Oil change',
  ref: 'M-42',
  type: 'Planned',
  priority: 'Medium',
  status: 'Pending',
  assigned_to: { id: 1, username: 'admin' },
  created_by: { id: 1, username: 'admin' },
  asset: sampleAssets[0],
  planned_starting_date: '2026-10-20T08:00:00Z',
  planned_finished: '2026-10-20T10:00:00Z',
};

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByLabel(label).click();
  await page.getByRole('option', { name: option }).click();
}

test('creating a plan from an empty Agenda slot sends a POST', async ({ page, backend }) => {
  backend.json('POST', /^\/api\/maintenance-plans\/$/, { ...plan, uuid: 'new' }, 201);
  await login(page);
  await page.getByRole('link', { name: 'Agenda' }).click();

  // Click an empty day in the month view; the form opens with that day prefilled
  // (local time, no timezone shift).
  const day = page.locator('.fc-daygrid-day:not(.fc-day-other)').nth(10);
  const date = await day.getAttribute('data-date');
  await day.click();
  await expect(page.getByText('New Maintenance Plan')).toBeVisible();
  await expect(page.getByLabel('Planned Start')).toHaveValue(`${date}T00:00`);

  await page.getByLabel('Name').fill('Belt check');
  await page.getByLabel('Reference').fill('M-100');
  await chooseOption(page, 'Assigned To', 'admin');
  await chooseOption(page, 'Asset', 'Pump');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() => backend.calls(/^\/api\/maintenance-plans\/$/, 'POST').length).toBe(1);
  const [request] = backend.calls(/^\/api\/maintenance-plans\/$/, 'POST');
  expect(request.method()).toBe('POST');
  expect(new URL(request.url()).pathname).toBe('/api/maintenance-plans/');
});

test('editing an existing plan sends a PATCH to its own URL', async ({ page, backend }) => {
  backend.json('GET', /^\/api\/maintenance-plans\/$/, [plan]);
  backend.json('PATCH', /^\/api\/maintenance-plans\/plan-42\/$/, plan);
  await login(page);
  await page.getByRole('link', { name: 'Maintenance plans' }).click();

  await page.getByRole('rowheader', { name: 'Oil change' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByText('Edit Maintenance Plan')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => backend.calls(/^\/api\/maintenance-plans\/plan-42\/$/, 'PATCH').length).toBe(1);
});
