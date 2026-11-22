import { expect, test } from '../support/test';
import { testUser } from '../support/fixtures';

test.use({ apiRoutes: { 'GET /auth/me': { body: testUser } } });

test('logout uses the server request token when an antiforgery cookie already exists', async ({ mockedPage: page }) => {
  await page.route('**/config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.__APP_CONFIG__ = { AUTH_MODE: "cookie", API_BASE_URL: "/api" };',
  }));

  await page.context().addCookies([{
    name: '__Host-rr_csrf',
    value: 'synthetic-cookie-token',
    url: 'https://localhost:4173',
    secure: true,
    sameSite: 'Strict',
  }]);

  let csrfRequests = 0;
  let logoutRequests = 0;
  await page.route('**/api/auth/csrf', async route => {
    csrfRequests += 1;
    await route.fulfill({ json: { token: 'synthetic-request-token' } });
  });
  await page.route('**/api/auth/logout', async route => {
    logoutRequests += 1;
    expect(route.request().headers()['x-csrf-token']).toBe('synthetic-request-token');
    expect(route.request().headers()['x-csrf-token']).not.toBe('synthetic-cookie-token');
    expect(route.request().headers().cookie).toContain('__Host-rr_csrf=');
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/dashboard');
  await expect(page.getByText(`Welcome, ${testUser.name}`).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Welcome, ${testUser.name}`).first()).toBeVisible();

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL('/login');
  await expect(page.getByText('Logout could not be completed. Please try again.')).toHaveCount(0);
  expect(csrfRequests).toBe(1);
  expect(logoutRequests).toBe(1);
});
