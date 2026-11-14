import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const environment = process.env.PLAYWRIGHT_ENV;
if (environment !== 'dev' && environment !== 'test') {
  throw new Error('PLAYWRIGHT_ENV must be dev or test for authenticated browser validation.');
}

const baseURL = process.env.BASE_URL || `https://${environment}.recruiterreply.com`;
const authDirectory = process.env.PLAYWRIGHT_AUTH_DIR ||
  path.join(os.tmpdir(), `recruiterreply-playwright-${environment}`);
const storageState = path.join(authDirectory, 'storage-state.json');

export default defineConfig({
  testDir: './tests/e2e/authenticated',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-auth-report', open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    storageState,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: `${environment}-auth-setup`,
      testMatch: /.*\.setup\.ts/,
      // The setup project creates this file; applying it here would make
      // Playwright fail before the setup test can authenticate.
      use: { ...devices['Desktop Chrome'], baseURL, storageState: undefined },
    },
    {
      name: `${environment}-authenticated`,
      testMatch: /.*\.spec\.ts/,
      dependencies: [`${environment}-auth-setup`],
    },
  ],
});

export { authDirectory, baseURL, environment, storageState };
