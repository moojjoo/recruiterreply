import { test, expect } from '../support/test';

test('product analytics events are blocked on Dev even after explicit consent', async ({ mockedPage: page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept All' }).click();
  const events = await page.evaluate(async () => {
    const analytics = await import('../../frontend/src/utils/productAnalytics');
    const before = (window as unknown as { dataLayer: IArguments[] }).dataLayer.length;
    for (const event of ['sign_up', 'analysis_completed', 'reply_generated', 'offer_compared'] as const) {
      analytics.trackProductEvent(event);
    }
    return (window as unknown as { dataLayer: IArguments[] }).dataLayer.slice(before).map(args => args[0]);
  });
  expect(events).not.toContain('event');
});

test('product analytics events are blocked after rejection', async ({ mockedPage: page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject Optional' }).click();
  const events = await page.evaluate(async () => {
    const analytics = await import('../../frontend/src/utils/productAnalytics');
    const before = (window as unknown as { dataLayer: IArguments[] }).dataLayer.length;
    analytics.trackProductEvent('sign_up');
    return (window as unknown as { dataLayer: IArguments[] }).dataLayer.slice(before).map(args => args[0]);
  });
  expect(events).not.toContain('event');
});
