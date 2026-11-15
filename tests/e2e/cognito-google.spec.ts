import { test, expect } from '../support/test';

// Local contract coverage only: neither Cognito nor Google receives a request.
test.use({ apiRoutes: { 'GET /auth/me': { status: 401, body: {} } } });

test.beforeEach(async ({ mockedPage: page }) => {
  await page.route('**/config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.__APP_CONFIG__ = { AUTH_MODE: "cookie", API_BASE_URL: "/api" };',
  }));
});

for (const path of ['/login', '/register']) {
  for (const provider of ['Google', 'email']) {
    test(`${path} starts ${provider} through the application BFF`, async ({ mockedPage: page }) => {
      const destination = 'https://application-cognito.example.test/oauth2/authorize';
      await page.route('https://application-cognito.example.test/**', route => route.fulfill({
        contentType: 'text/html', body: '<h1>Synthetic authorization destination</h1>',
      }));
      await page.route('**/api/auth/cognito/start*', async route => {
        expect(route.request().method()).toBe('GET');
        const url = new URL(route.request().url());
        expect(url.searchParams.get('provider')).toBe(provider === 'Google' ? 'Google' : null);
        await route.fulfill({ json: { authorizationUrl: destination } });
      });
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue with email' })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
      const started = page.waitForRequest('**/api/auth/cognito/start*');
      await page.getByRole('button', { name: `Continue with ${provider}` }).click();
      await started;
      await expect(page).toHaveURL(destination);
    });
  }

  test(`${path} handles Google start failure without falling back to legacy auth`, async ({ mockedPage: page }) => {
    await page.route('**/api/auth/cognito/start*', route => route.fulfill({
      status: 503, json: { error: 'synthetic internal detail' },
    }));
    await page.goto(path);
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('alert')).toContainText('currently unavailable');
    await expect(page.getByRole('alert')).not.toContainText('internal detail');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    await expect(page).toHaveURL(path);
    expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
  });
}
