import { defineConfig, devices } from '@playwright/test';

/**
 * Frontend regression suite. Every /api call is mocked (see tests/support/mockApi.ts),
 * so only the built frontend needs to run — no backend, DB, or third-party services.
 * See https://playwright.dev/docs/test-configuration.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Serves the production build; run `npm --prefix frontend run build` first. */
  webServer: {
    command: `npm --prefix frontend run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
