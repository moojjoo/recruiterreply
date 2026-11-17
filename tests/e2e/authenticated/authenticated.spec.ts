import { test, expect } from '@playwright/test';

test('authenticated user reaches the tools without browser-readable tokens', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).not.toHaveURL(/\/login(?:$|[?#])/i);
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible();

  const browserStorage = await page.evaluate(() => ({
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage),
  }));
  expect(browserStorage.localStorage).not.toContain('authToken');
  expect(browserStorage.sessionStorage).not.toContain('authToken');
});

test('refreshing an authenticated deep link keeps the session', async ({ page }) => {
  await page.goto('/analyze');
  await expect(page).not.toHaveURL(/\/login(?:$|[?#])/i);
  await page.reload();
  await expect(page).not.toHaveURL(/\/login(?:$|[?#])/i);
});

test('application logout retains the independent perimeter session', async ({ page, context }) => {
  await page.goto('/dashboard');
  const beforeNames = (await context.cookies()).map(cookie => cookie.name);
  expect(beforeNames).toContain('rr_session');
  expect(beforeNames).toContain('__Host-rr_session');

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login(?:$|[?#])/i, { timeout: 30_000 });

  const afterNames = (await context.cookies()).map(cookie => cookie.name);
  expect(afterNames).toContain('rr_session');
  expect(afterNames).not.toContain('__Host-rr_session');

  // The edge still admits the browser, but the application route remains
  // protected because its independent BFF session was revoked.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login(?:$|[?#])/i);
});

test('failed application logout keeps the application session active', async ({ page, context }) => {
  await page.route('**/api/auth/logout', route => route.abort('failed'));
  await page.goto('/dashboard');

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/dashboard(?:$|[?#])/i);
  await expect(page.getByText('Logout could not be completed. Please try again.')).toBeVisible();
  const cookieNames = (await context.cookies()).map(cookie => cookie.name);
  expect(cookieNames).toContain('rr_session');
  expect(cookieNames).toContain('__Host-rr_session');
});
