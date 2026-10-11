import { test, expect } from '../support/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adapter = readFileSync(resolve(__dirname, '../../frontend/src/utils/productAnalytics.ts'), 'utf8');

test('analytics adapter enforces production hostname and affirmative consent', async () => {
  expect(adapter).toContain('window.location.protocol !== "https:"');
  expect(adapter).toContain('window.location.hostname !== "recruiterreply.com"');
  expect(adapter).toContain('consent?.analytics !== true');
  expect(adapter).toContain('gtag("event", event)');
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
