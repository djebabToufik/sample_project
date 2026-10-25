import type { Page, WebSocketRoute } from '@playwright/test';
import { test, expect, login, sampleAssets } from './fixtures';

// Live data: Playwright plays the backend's WebSocket server (/ws/... on the app's own site).

interface Socket {
  url: URL;
  route: WebSocketRoute;
  closed: boolean;
}

/** Answer every live channel; `onConnect` decides what each connection receives. */
async function fakeSockets(page: Page, onConnect: (socket: Socket) => void = () => {}) {
  const sockets: Socket[] = [];
  await page.routeWebSocket(/\/ws\//, (route) => {
    const socket: Socket = { url: new URL(route.url()), route, closed: false };
    route.onClose(() => (socket.closed = true));
    sockets.push(socket);
    onConnect(socket);
  });
  return sockets;
}

const channel = (socket: Socket) => socket.url.pathname.split('/')[2];
const machineOf = (socket: Socket) => socket.url.searchParams.get('machine');
const open = (sockets: Socket[], name: string) => sockets.filter((s) => channel(s) === name && !s.closed);

const event = (uuid: string, state: string) => ({
  uuid,
  state,
  created_at: '2026-01-05T08:00:00Z',
  machine: sampleAssets[0],
  cell: null,
  fault: null,
  product: { product_name: 'Bolt' },
  quantity: 12,
  scrap: 1,
  is_filled: false,
});

function oeeMessage(latestState: string) {
  return JSON.stringify({
    data: {},
    oee: Array.from({ length: 24 }, (_, hour) => ({ oee: 50 + hour })),
    list: [event('latest', latestState)],
  });
}

test('each line card connects for its line and shows the latest event', async ({ page }) => {
  const sockets = await fakeSockets(page, (socket) => {
    if (channel(socket) === 'machine-oee') socket.route.send(oeeMessage('run'));
  });
  await login(page);
  await page.getByRole('link', { name: 'Live', exact: true }).click();

  await expect.poll(() => open(sockets, 'machine-oee').map(machineOf).sort()).toEqual(['a1', 'a2', 'a3']);
  // The browser sends the session cookie; nothing secret in the URL.
  for (const socket of sockets) expect([...socket.url.searchParams.keys()]).toEqual(['machine']);

  await page.getByLabel('Line Pump').getByRole('button', { name: 'Last event' }).click();
  const details = page.getByRole('menu', { name: 'Event details' });
  await expect(details).toContainText('Status run');
  await expect(details).toContainText('Product Bolt');
});

test('the event strip shows the events it receives', async ({ page, backend }) => {
  backend.json('GET', /^\/api\/downtime\/$/, {});
  await fakeSockets(page, (socket) => {
    if (channel(socket) === 'machine-data') {
      socket.route.send(JSON.stringify({ data: [event('e1', 'run'), event('e2', 'fault')] }));
    }
  });
  await login(page, '/dashboards/oee');

  const strip = page.getByLabel('Latest events');
  await expect(strip.getByLabel('Event run')).toBeVisible();
  await expect(strip.getByLabel('Event fault')).toBeVisible();
});

test('leaving the page closes its connections', async ({ page }) => {
  const sockets = await fakeSockets(page);
  await login(page);
  await page.getByRole('link', { name: 'Live', exact: true }).click();
  await expect.poll(() => open(sockets, 'machine-oee').length).toBe(3);

  await page.getByRole('link', { name: 'Lines' }).click();
  await expect.poll(() => open(sockets, 'machine-oee').length).toBe(0);
});

test('reconnects after the connection drops', async ({ page }) => {
  let connections = 0;
  const sockets = await fakeSockets(page, (socket) => {
    if (channel(socket) !== 'machine-oee' || machineOf(socket) !== 'a1') return;
    connections++;
    // First connection: drop it right away. Later ones: send data.
    if (connections === 1) socket.route.close();
    else socket.route.send(oeeMessage('stop'));
  });
  await login(page);
  await page.getByRole('link', { name: 'Live', exact: true }).click();

  await expect.poll(() => connections, { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  await page.getByLabel('Line Pump').getByRole('button', { name: 'Last event' }).click();
  await expect(page.getByRole('menu', { name: 'Event details' })).toContainText('Status stop');
  expect(open(sockets, 'machine-oee').filter((s) => machineOf(s) === 'a1')).toHaveLength(1);
});

test('the card links open the dashboards of that line', async ({ page, backend }) => {
  backend.json('GET', /^\/api\/downtime\/$/, {});
  await fakeSockets(page);
  await login(page);

  for (const [link, heading] of [
    ['OEE', 'Oee'],
    ['Downtimes', 'Downtimes'],
    ['Energy & costs', 'Energy & costs'],
  ]) {
    await page.getByRole('link', { name: 'Live', exact: true }).click();
    await page.getByLabel('Line Conveyor').getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByLabel('breadcrumb')).toContainText(heading);
    await expect(page.getByRole('combobox', { name: 'Line' })).toHaveText('Conveyor');
  }
});

test('the side menu groups the pages and highlights the open one', async ({ page }) => {
  await login(page);
  const menu = page.getByRole('navigation', { name: 'Main menu' });
  for (const name of ['Live', 'OEE', 'Downtimes', 'Energy & costs', 'Maintenance plans', 'Lines', 'Users']) {
    await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
  }

  await menu.getByRole('link', { name: 'Downtimes', exact: true }).click();
  await expect(menu.getByRole('link', { name: 'Downtimes', exact: true })).toHaveClass(/Mui-selected/);
  await expect(menu.getByRole('link', { name: 'OEE', exact: true })).not.toHaveClass(/Mui-selected/);
});
