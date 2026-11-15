import { test, expect } from '@playwright/test';

// Uses the existing perimeter/application setup and real deployed catalog.
// Does not change the QA user's subscription or submit payment details.
test('Dev billing catalog and pricing disclose all approved offers', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_ENV !== 'dev', 'Issue 544 validation is Dev-only.');
  const catalogResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/billing/plans' && response.request().method() === 'GET');
  await page.goto('/pricing');
  const response = await catalogResponse;
  expect(response.status()).toBe(200);
  const { plans } = await response.json();
  for (const [tier, interval, unitAmount] of [
    ['professional', 'month', 2400],
    ['professional', 'year', 22900],
    ['recruiter_pro', 'month', 4900],
    ['recruiter_pro', 'year', 46900],
  ]) {
    expect(plans.filter((plan: { tier: string; interval: string }) =>
      plan.tier === tier && plan.interval === interval)).toEqual([
      expect.objectContaining({ tier, interval, unitAmount, currency: 'usd', intervalCount: 1, trialPeriodDays: 7 }),
    ]);
  }
  await expect(page.getByText('$24', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('$49', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('7-day free trial — no charge today').first()).toBeVisible();
  await page.getByRole('button', { name: /Annual — save 20%/ }).click();
  await expect(page.getByText('$229', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('$469', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('first charge occurs after the trial ends')).toBeVisible();
});
