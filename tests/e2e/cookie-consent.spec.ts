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
  // CI uses localhost: optional analytics must stay disabled even after acceptance.
  expect(analyticsRequests).toEqual([]);
  await page.evaluate(() => window.rrLoadAnalytics?.());
  expect(analyticsRequests).toEqual([]);
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


test('persisted consent never activates GA4 outside production', async ({ mockedPage: page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', request => {
    if (/googletagmanager\.com\/gtag|google-analytics\.com\/(g\/collect|collect)/.test(request.url())) analyticsRequests.push(request.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem('rr-cookie-consent-v1', JSON.stringify({ version: 1, analytics: true, timestamp: new Date().toISOString() }));
  });
  await page.goto('/');
  await page.reload();
  await page.evaluate(() => window.rrLoadAnalytics?.());
  expect(analyticsRequests).toEqual([]);
  const granted = await page.evaluate(() => (window as unknown as { dataLayer: IArguments[] }).dataLayer.some(args => args[0] === 'consent' && args[1] === 'update' && args[2]?.analytics_storage === 'granted'));
  expect(granted).toBe(false);
});

const consentKey = 'rr-cookie-consent-v1';

test('reject stays denied after navigation and reload without GA4 traffic', async ({ mockedPage: page }) => {
  const traffic: string[] = [];
  page.on('request', req => {
    if (/googletagmanager\\.com|google-analytics\\.com/.test(req.url())) traffic.push(req.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  await page.goto('/policy');
  await page.reload();
  expect(traffic).toEqual([]);
  const state = await page.evaluate(key => ({
    choice: JSON.parse(localStorage.getItem(key) || 'null'),
    updates: (window as unknown as { dataLayer: IArguments[] }).dataLayer
      .filter(args => args[0] === 'consent').map(args => args[2]?.analytics_storage),
  }), consentKey);
  expect(state.choice.analytics).toBe(false);
  expect(state.updates).toContain('denied');
  expect(state.updates).not.toContain('granted');
});

test('customized opt-in persists but never tracks on localhost', async ({ mockedPage: page }) => {
  const traffic: string[] = [];
  page.on('request', req => {
    if (/googletagmanager\\.com|google-analytics\\.com/.test(req.url())) traffic.push(req.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('checkbox', { name: 'Allow optional analytics' }).check();
  await page.getByRole('button', { name: 'Save Preferences' }).click();
  await page.reload();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').analytics, consentKey)).toBe(true);
  expect(traffic).toEqual([]);
  const state = await page.evaluate(() => (window as unknown as { dataLayer: IArguments[] }).dataLayer
    .filter(args => args[0] === 'consent').map(args => args[2]?.analytics_storage));
  expect(state).not.toContain('granted');
});

test('withdrawal removes GA cookies and survives reload', async ({ mockedPage: page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept All' }).click();
  await page.evaluate(() => { document.cookie = '_ga=synthetic; path=/'; });
  await page.getByRole('button', { name: 'Cookie Settings' }).click();
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  await page.reload();
  expect(await page.evaluate(() => document.cookie)).not.toContain('_ga=');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').analytics, consentKey)).toBe(false);
});

test('GPC is surfaced and analytics remains optional and initially denied', async ({ mockedPage: page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  });
  await page.goto('/');
  await expect(page.getByText(/Global Privacy Control signal/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { dataLayer: IArguments[] }).dataLayer
    .filter(args => args[0] === 'consent').every(args => args[2]?.analytics_storage === 'denied'))).toBe(true);
});

test('keyboard-only rejection is accessible', async ({ mockedPage: page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toBeVisible();
  await page.getByRole('button', { name: 'Reject Optional' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toHaveCount(0);
});

test('cookie dialog remains usable on mobile viewport', async ({ mockedPage: page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reject Optional' })).toBeVisible();
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toHaveCount(0);
});

test('authenticated route does not send GA4 or synthetic PII', async ({ authedPage: page }) => {
  const traffic: string[] = [];
  page.on('request', req => {
    if (/googletagmanager\\.com|google-analytics\\.com/.test(req.url())) traffic.push(req.url());
  });
  await page.goto('/dashboard');
  await page.reload();
  expect(traffic).toEqual([]);
  expect(traffic.join(' ')).not.toMatch(/email|resume|stripe|recruiter|token/i);
});

test('built frontend includes a fail-closed canonical production hostname gate', async ({ mockedPage: page }) => {
  const response = await page.request.get('/');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("location.protocol === 'https:'");
  expect(html).toContain("location.hostname === 'recruiterreply.com'");
  expect(html).toContain("if (!isProduction || window.rrAnalyticsLoaded) return;");
  expect(html).not.toContain("location.hostname.endsWith(");
});


test('audit endpoint outage cannot block reject or withdrawal', async ({ mockedPage: page }) => {
  await page.route('**/consent-events', route => route.abort('failed'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  await expect(page.getByRole('dialog', { name: 'Cookie preferences' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('rr-cookie-consent-v1') || '{}').analytics
  )).toBe(false);

  await page.getByRole('button', { name: 'Cookie Settings' }).click();
  await page.getByRole('button', { name: 'Accept All' }).click();
  await page.evaluate(() => { document.cookie = '_ga=synthetic; path=/'; });
  await page.getByRole('button', { name: 'Cookie Settings' }).click();
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  await page.reload();

  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('rr-cookie-consent-v1') || '{}').analytics
  )).toBe(false);
  expect(await page.evaluate(() => document.cookie)).not.toContain('_ga=');
});
