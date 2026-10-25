import { test as base, expect, type Page, type Request, type Route } from '@playwright/test';

// The app calls the backend on its own site (see src/Config.ts). Every backend call is
// answered here instead, including the login session (kept across page reloads).
export const CSRF_TOKEN = 'test-csrf-token';

export const adminProfile = {
  uuid: 'profile-admin',
  type: 'Admin',
  user: { id: 1, username: 'admin', email: 'admin@example.com', first_name: 'Ada', last_name: 'Admin' },
  organization: { uuid: 'org-1', name: 'Acme' },
};

export const sampleAssets = [
  {
    uuid: 'a1',
    name: 'Pump',
    ref: 'P-1',
    serial_number: 'S1',
    asset_type: 'Equipment',
    status: 'Active',
    location: 'Hall A',
    warranty_expiration_date: '2030-01-01T00:00:00Z',
  },
  {
    uuid: 'a2',
    name: 'Conveyor',
    ref: 'C-1',
    serial_number: 'S2',
    asset_type: 'Equipment',
    status: 'Inactive',
    location: 'Hall B',
    warranty_expiration_date: '2020-01-01T00:00:00Z',
  },
  {
    uuid: 'a3',
    name: 'Mixer',
    ref: 'M-1',
    serial_number: 'S3',
    asset_type: 'Equipment',
    status: 'Under Maintenance',
    location: 'Hall C',
    warranty_expiration_date: '2028-06-01T00:00:00Z',
  },
];

type Handler = (route: Route, request: Request) => Promise<void> | void;

type Profile = typeof adminProfile;

/** Fake backend: answers /api/ calls and records every request for assertions. */
export class Backend {
  readonly requests: Request[] = [];
  /** Profile returned by login and the session check; null = account without profile. */
  profile: Profile | null = adminProfile;
  /** The backend session of this browser (survives page reloads, ends with logout). */
  loggedIn = false;
  private readonly handlers: { method: string; path: RegExp; handler: Handler }[] = [];

  constructor(private readonly page: Page) {}

  /** Answer `method path` (path is a regex on the URL path) with a handler. */
  on(method: string, path: RegExp, handler: Handler): this {
    this.handlers.unshift({ method, path, handler });
    return this;
  }

  /** Shortcut: answer with JSON. */
  json(method: string, path: RegExp, body: unknown, status = 200): this {
    return this.on(method, path, (route) => route.fulfill({ status, json: body }));
  }

  async start(): Promise<void> {
    // Django sets this cookie on the session check; the app sends it back as X-CSRFToken.
    await this.page
      .context()
      .addCookies([{ name: 'csrftoken', value: CSRF_TOKEN, domain: 'localhost', path: '/' }]);
    const isBackend = (url: URL) => url.hostname === 'localhost' && url.pathname.startsWith('/api/');
    await this.page.route(isBackend, async (route, request) => {
      this.requests.push(request);
      const { pathname } = new URL(request.url());
      const match = this.handlers.find((h) => h.method === request.method() && h.path.test(pathname));
      if (match) return match.handler(route, request);
      // Anything not described by the test: empty list, like an empty database.
      return route.fulfill({ status: 200, json: [] });
    });
  }

  /** Requests whose path matches, optionally filtered by method. */
  calls(path: RegExp, method?: string): Request[] {
    return this.requests.filter(
      (r) => path.test(new URL(r.url()).pathname) && (!method || r.method() === method),
    );
  }
}

/** Default backend for a logged-in admin with a few assets. */
function defaultBackend(page: Page): Backend {
  const backend = new Backend(page);
  return backend
    .on('GET', /^\/api\/auth\/session\/$/, (route) =>
      backend.loggedIn
        ? route.fulfill({ json: { profile: backend.profile } })
        : route.fulfill({ status: 401, json: { detail: 'Authentication credentials were not provided.' } }),
    )
    .on('POST', /^\/api\/auth\/login\/$/, (route) => {
      backend.loggedIn = true;
      return route.fulfill({ json: { profile: backend.profile } });
    })
    .on('POST', /^\/api\/auth\/logout\/$/, (route) => {
      backend.loggedIn = false;
      return route.fulfill({ status: 204 });
    })
    .json('GET', /^\/api\/auth\/settings\/$/, { signup: true })
    .json('GET', /^\/api\/assets\/$/, sampleAssets)
    .json('GET', /^\/api\/users\/$/, [adminProfile]);
}

/** Log in through the real login form. */
export async function login(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill('secret');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
}

// Every test gets a running fake backend. Handlers are looked up per request,
// so tests can add or override them with backend.on()/json() at any time.
export const test = base.extend<{ backend: Backend }>({
  backend: [
    async ({ page }, use) => {
      const backend = defaultBackend(page);
      await backend.start();
      await use(backend);
    },
    { auto: true },
  ],
});

export { expect };
