import { test, expect } from '../support/test';

// Technical checks only. Jurisdiction-specific GPC rights and legal disclosures
// require counsel's approval before issue #260 can be closed.
test('GPC preserves an explicit analytics choice while keeping ad consent denied', async ({ mockedPage: page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  });
  await page.goto('/');
  await expect(page.getByText(/Global Privacy Control signal/)).toBeVisible();
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('checkbox', { name: 'Allow optional analytics' }).check();
  await page.getByRole('button', { name: 'Save Preferences' }).click();
  const state = await page.evaluate(() => ({
    analytics: JSON.parse(localStorage.getItem('rr-cookie-consent-v1') || '{}').analytics,
    consentUpdates: (window as unknown as { dataLayer: IArguments[] }).dataLayer
      .filter(args => args[0] === 'consent').map(args => args[2]),
  }));
  expect(state.analytics).toBe(true);
  expect(state.consentUpdates.every(update =>
    update?.ad_storage === 'denied' &&
    update?.ad_user_data === 'denied' &&
    update?.ad_personalization === 'denied'
  )).toBe(true);
});

test('consent inventory records known local keys and excludes GA after rejection', async ({ mockedPage: page }) => {
  const thirdPartyRequests: string[] = [];
  page.on('request', request => {
    if (/google-analytics\.com|googletagmanager\.com/.test(request.url())) thirdPartyRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  const snapshot = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
    cookies: document.cookie.split(';').map(v => v.trim().split('=')[0]).filter(Boolean),
  }));
  expect(snapshot.keys).toContain('rr-cookie-consent-v1');
  expect(snapshot.cookies.some(name => /^_ga(?:_|$)/.test(name))).toBe(false);
  expect(thirdPartyRequests).toEqual([]);
});
