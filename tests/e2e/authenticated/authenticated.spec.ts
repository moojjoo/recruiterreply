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

test('hosted logout leaves the protected application', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/https:\/\/(?:dev|test)\.recruiterreply\.com\/$/i, { timeout: 30_000 });
  await page.goto('/dashboard');
  await expect(page).not.toHaveURL(/\/dashboard(?:$|[?#])/i);
});
