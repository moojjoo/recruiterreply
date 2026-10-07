import { test, expect } from '../support/test';
import { analysis, comparison, reply } from '../support/fixtures';

const serverError = { status: 500, body: { error: 'Upstream AI failure' } };

test.describe('message analyzer', () => {
  test('renders analysis results', async ({ authedPage: page }) => {
    await page.goto('/analyze');
    await page.getByLabel('Recruiter message input').fill('Hi! Remote role, $150k-$170k.');
    await page.getByRole('button', { name: /Analyze Message/ }).click();

    await expect(page.getByRole('heading', { name: /Analysis Results/ })).toBeVisible();
    await expect(page.getByText(analysis.redFlags[0])).toBeVisible();
    await expect(page.getByText(analysis.suggestedResponse)).toBeVisible();
  });

  test.describe('on server error', () => {
    test.use({ apiRoutes: { 'POST /analyze-recruiter-message': serverError } });

    test('shows the error', async ({ authedPage: page }) => {
      await page.goto('/analyze');
      await page.getByLabel('Recruiter message input').fill('Hello');
      await page.getByRole('button', { name: /Analyze Message/ }).click();

      await expect(page.getByRole('alert')).toContainText('Upstream AI failure');
    });
  });
});

test.describe('reply generator', () => {
  test('renders the generated reply', async ({ authedPage: page }) => {
    await page.goto('/reply');
    await page.getByLabel('Decline Politely').check();
    await page.getByLabel('Recruiter message', { exact: true }).fill('Are you open to a new role?');
    await page.getByRole('button', { name: /Generate Reply/ }).click();

    await expect(page.getByRole('heading', { name: 'Generated Reply' })).toBeVisible();
    await expect(page.getByText(reply.reply)).toBeVisible();
  });

  test.describe('on server error', () => {
    test.use({ apiRoutes: { 'POST /generate-reply': serverError } });

    test('shows the error', async ({ authedPage: page }) => {
      await page.goto('/reply');
      await page.getByLabel('Recruiter message', { exact: true }).fill('Hello');
      await page.getByRole('button', { name: /Generate Reply/ }).click();

      await expect(page.getByRole('alert')).toContainText('Failed to generate reply');
    });
  });
});

test.describe('offer comparison', () => {
  async function fillOffers(page: import('@playwright/test').Page) {
    const companies = page.getByPlaceholder('Company name');
    const salaries = page.getByPlaceholder('150000');
    await companies.nth(0).fill('Acme Corp');
    await salaries.nth(0).fill('160000');
    await companies.nth(1).fill('Globex');
    await salaries.nth(1).fill('150000');
    await page.getByRole('button', { name: 'Compare Offers' }).click();
  }

  test('renders the recommendation', async ({ authedPage: page }) => {
    await page.goto('/compare');
    await fillOffers(page);

    await expect(page.getByRole('heading', { name: 'Comparison Results' })).toBeVisible();
    await expect(page.getByText(comparison.recommendation)).toBeVisible();
  });

  test('requires both company names', async ({ authedPage: page }) => {
    await page.goto('/compare');
    await page.getByRole('button', { name: 'Compare Offers' }).click();
    await expect(page.getByText('Please enter company names for both offers')).toBeVisible();
  });

  test.describe('on server error', () => {
    test.use({ apiRoutes: { 'POST /compare-offers': serverError } });

    test('shows the error', async ({ authedPage: page }) => {
      await page.goto('/compare');
      await fillOffers(page);
      await expect(page.getByText(/Failed to compare offers/)).toBeVisible();
    });
  });
});

test('opportunities page renders', async ({ authedPage: page }) => {
  await page.goto('/opportunities');
  await expect(page.getByRole('heading', { name: 'Opportunities', level: 1 })).toBeVisible();
});

test('dashboard links to each tool', async ({ authedPage: page }) => {
  await page.goto('/dashboard');
  for (const [name, path] of [
    ['Analyze Messages', '/analyze'],
    ['Generate Replies', '/reply'],
    ['Compare Offers', '/compare'],
  ] as const) {
    await page.getByRole('link', { name: new RegExp(name) }).click();
    await expect(page).toHaveURL(path);
    await page.goto('/dashboard');
  }
});
