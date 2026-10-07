import type { Page } from '@playwright/test';
import * as fx from './fixtures';

export interface MockResponse {
  status?: number;
  body?: unknown;
}

/** Keyed by "METHOD /path" relative to /api, e.g. "POST /auth/login". */
export type MockRoutes = Record<string, MockResponse>;

export const defaultRoutes: MockRoutes = {
  'GET /auth/me': { body: fx.testUser },
  'POST /auth/login': { body: fx.authResponse },
  'POST /auth/register': { body: fx.authResponse },
  'GET /billing/usage': { body: fx.usage },
  'POST /analyze-recruiter-message': { body: fx.analysis },
  'POST /generate-reply': { body: fx.reply },
  'POST /compare-offers': { body: fx.comparison },
};

/**
 * Intercepts every /api request. Overrides win over defaults. Requests with no
 * mock get a 501 and are recorded in the returned array so tests can fail on them.
 */
export async function mockApi(page: Page, overrides: MockRoutes = {}): Promise<string[]> {
  const routes = { ...defaultRoutes, ...overrides };
  const unmocked: string[] = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const key = `${request.method()} ${path}`;
    const mock = routes[key];

    if (!mock) {
      unmocked.push(key);
      await route.fulfill({ status: 501, json: { error: `No mock for ${key}` } });
      return;
    }

    await route.fulfill({ status: mock.status ?? 200, json: mock.body ?? {} });
  });

  return unmocked;
}
