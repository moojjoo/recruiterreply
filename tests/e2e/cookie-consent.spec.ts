import { test, expect } from '../support/test';

test('analytics remains blocked until visitor opts in', async ({ mockedPage: page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', request => {
    if (/googletagmanager\.com\/gtag|google-analytics\.com\/(g\/collect|collect)/.test(request.url())) analyticsRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toBeVisible();
  expect(analyticsRequests).toEqual([]);
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  await page.reload();
  expect(analyticsRequests).toEqual([]);
  await page.getByRole('button', { name: 'Cookie Settings' }).click();
  await page.getByRole('button', { name: 'Accept All' }).click();
  await expect.poll(() => analyticsRequests.length).toBeGreaterThan(0);
});

test('preferences remain available and withdrawal removes optional analytics', async ({ mockedPage: page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('checkbox', { name: 'Allow optional analytics' }).check();
  await page.getByRole('button', { name: 'Save Preferences' }).click();
  await page.getByRole('button', { name: 'Cookie Settings' }).click();
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('rr-cookie-consent-v1') || '{}').analytics)).toBe(false);
});
