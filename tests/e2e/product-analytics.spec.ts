import { test, expect } from '../support/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adapter = readFileSync(resolve(__dirname, '../../frontend/src/utils/productAnalytics.ts'), 'utf8');

test('analytics adapter enforces production hostname and affirmative consent', async () => {
  expect(adapter).toContain('window.location.protocol !== "https:"');
  expect(adapter).toContain('window.location.hostname !== PRODUCTION_HOST');
  expect(adapter).toContain('consent?.analytics === true');
  expect(adapter).toContain('window.gtag?.("event", event, args[0] ?? {})');
  expect(adapter).not.toMatch(/email|stripe_customer|recruiter_text|generated_reply/);
});

test('analytics event contract is bounded and SPA page views omit query strings', async () => {
  expect(adapter).toContain('begin_checkout: { plan_tier: "professional" | "recruiter_pro" }');
  expect(adapter).toContain('feature_error: { feature: "analyze" | "generate" | "compare"; error_code: "quota_exceeded" | "request_failed" }');
  expect(adapter).toContain('subscription_cancelled: { plan_tier: "professional" | "recruiter_pro" }');
  expect(adapter).toContain('rr-analytics-subscription-cancelled-');
  expect(adapter).toContain('pathname.split(/[?#]/, 1)[0]');
  expect(adapter).toContain('previousPagePath === safePath');
});

test('GA4 requests remain blocked on Dev despite explicit consent', async ({ mockedPage: page }) => {
  const traffic: string[] = [];
  page.on('request', req => {
    if (/googletagmanager\\.com|google-analytics\\.com/.test(req.url())) traffic.push(req.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept All' }).click();
  await page.reload();
  expect(traffic).toEqual([]);
});

test('Dev emits no product events or page views into the GA queue', async ({ mockedPage: page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rr-cookie-consent-v1', JSON.stringify({
      version: 1, analytics: true, timestamp: new Date().toISOString(),
    }));
  });
  await page.goto('/pricing');
  await page.goto('/');
  const productCalls = await page.evaluate(() =>
    (window as unknown as { dataLayer: IArguments[] }).dataLayer
      .filter(args => args[0] === 'event'));
  expect(productCalls).toEqual([]);
});
