import { test as base, expect, type Page } from '@playwright/test';
import { authResponse } from './fixtures';
import { mockApi, type MockRoutes } from './mockApi';

interface Fixtures {
  /** Per-test API overrides, set with `test.use({ apiRoutes: {...} })`. */
  apiRoutes: MockRoutes;
  /** Page with all /api calls mocked; fails the test on any unmocked call. */
  mockedPage: Page;
  /** mockedPage that starts logged in as fixtures.testUser. */
  authedPage: Page;
}

export const test = base.extend<Fixtures>({
  apiRoutes: [{}, { option: true }],

  mockedPage: async ({ page, apiRoutes }, use) => {
    const unmocked = await mockApi(page, apiRoutes);
    await use(page);
    expect(unmocked, 'API calls without a mock').toEqual([]);
  },

  authedPage: async ({ mockedPage }, use) => {
    // Same keys AuthContext reads on startup.
    await mockedPage.addInitScript(({ token, user }) => {
      if (!sessionStorage.getItem('e2e-seeded')) {
        localStorage.setItem('authToken', token);
        localStorage.setItem('userData', JSON.stringify(user));
        sessionStorage.setItem('e2e-seeded', '1');
      }
    }, authResponse);
    await use(mockedPage);
  },
});

export { expect };
