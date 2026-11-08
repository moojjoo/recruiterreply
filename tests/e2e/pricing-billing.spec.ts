import { test, expect } from '../support/test';

const professionalMonthly = {
  tier: 'professional',
  unitAmount: 2400,
  currency: 'usd',
  interval: 'month',
  intervalCount: 1,
  trialPeriodDays: 7,
};

const professionalAnnual = {
  ...professionalMonthly,
  unitAmount: 22900,
  interval: 'year',
};

const recruiterProMonthly = {
  ...professionalMonthly,
  tier: 'recruiter_pro',
  unitAmount: 4900,
};

const recruiterProAnnual = {
  ...recruiterProMonthly,
  unitAmount: 46900,
  interval: 'year',
};

const billingPlans = {
  plans: [professionalMonthly, professionalAnnual, recruiterProMonthly, recruiterProAnnual],
};

test.describe('pricing and billing', () => {
  test('shows monthly prices, annual savings, and trial disclosure', async ({ authedPage: page }) => {
    await page.goto('/pricing');

    await expect(page.getByRole('heading', { name: 'Simple, Transparent Pricing' })).toBeVisible();
    await expect(page.getByText('$24').first()).toBeVisible();
    await expect(page.getByText('$49').first()).toBeVisible();
    await expect(page.getByText('7-day free trial — no charge today').first()).toBeVisible();
    await expect(page.getByText('first charge occurs after the trial ends')).toBeVisible();

    await page.getByRole('button', { name: /Annual — save 20%/ }).click();

    await expect(page.getByText('$229').first()).toBeVisible();
    await expect(page.getByText('$469').first()).toBeVisible();
    await expect(page.getByText('/year').first()).toBeVisible();
  });

  test('uses safe monthly fallback prices when the catalog is unavailable', async ({ authedPage: page }) => {
    await page.route('**/api/billing/plans', async (route) => {
      await route.fulfill({ status: 503, json: { error: 'billing unavailable' } });
    });
    await page.goto('/pricing');

    await expect(page.getByText('$24').first()).toBeVisible();
    await expect(page.getByText('$49').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Annual — save 20%/ })).toHaveCount(0);
  });

  for (const [tier, interval, amount] of [
    ['professional', 'month', 2400],
    ['professional', 'year', 22900],
    ['recruiter_pro', 'month', 4900],
    ['recruiter_pro', 'year', 46900],
  ] as const) {
    test(`sends the ${tier} ${interval} checkout selection`, async ({ authedPage: page }) => {
      await page.route('**/api/billing/plans', async (route) => {
        await route.fulfill({ status: 200, json: billingPlans });
      });
      await page.route('**/api/billing/checkout-session', async (route) => {
        await route.fulfill({
          status: 200,
          json: { url: 'https://checkout.stripe.com/cs_test_pricing' },
        });
      });
      await page.route('https://checkout.stripe.com/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'text/html', body: 'checkout' });
      });
      await page.goto('/pricing');

      if (interval === 'year') {
        await page.getByRole('button', { name: /Annual — save 20%/ }).click();
      }
      const requestPromise = page.waitForRequest('**/api/billing/checkout-session');
      await page.getByRole('button', { name: tier === 'professional' ? 'Upgrade to Professional' : 'Upgrade to Recruiter Pro' }).click();
      const request = await requestPromise;

      expect(request.postDataJSON()).toEqual({ tier, interval });
      expect(amount).toBeGreaterThan(0);
    });
  }

  test('shows the trial end date and cancellation flow in Profile', async ({ authedPage: page }) => {
    await page.route('**/api/gmail/status', async (route) => {
      await route.fulfill({ status: 200, json: { isConnected: false } });
    });
    await page.route('**/api/billing/usage', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          subscriptionTier: 'professional',
          subscriptionStatus: 'trialing',
          subscriptionCurrentPeriodEnd: '2027-01-15T00:00:00Z',
          subscriptionCancelAtPeriodEnd: false,
          usage: [{ feature: 'analyze', used: 160, limit: 200 }],
        },
      });
    });
    await page.route('**/api/billing/cancel-subscription', async (route) => {
      await route.fulfill({ status: 204 });
    });
    await page.goto('/profile');

    await expect(page.getByText('Professional')).toBeVisible();
    await expect(page.getByText(/Free trial — first charge on/)).toBeVisible();
    await expect(page.getByText(/nearing this month\'s limit/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel subscription' }).click();
    await expect(page.getByRole('heading', { name: 'Cancel subscription?' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(page.getByText(/scheduled to cancel/)).toBeVisible();
  });
});
