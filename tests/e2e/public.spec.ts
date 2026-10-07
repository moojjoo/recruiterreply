import { test, expect } from '../support/test';

const pages = [
  { path: '/', heading: /Master Your Job Search/, level: 1 },
  { path: '/pricing', heading: 'Simple, Transparent Pricing', level: 1 },
  { path: '/terms', heading: 'Terms and Conditions', level: 1 },
  { path: '/policy', heading: 'Privacy Policy', level: 1 },
  { path: '/login', heading: 'Login', level: 2 },
  { path: '/register', heading: 'Create Account', level: 2 },
];

for (const { path, heading, level } of pages) {
  test(`${path} renders`, async ({ mockedPage: page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level })).toBeVisible();
  });
}

test('navbar and footer links navigate', async ({ mockedPage: page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Pricing' }).click();
  await expect(page).toHaveURL('/pricing');

  await page.getByRole('link', { name: 'Terms and Conditions' }).click();
  await expect(page).toHaveURL('/terms');

  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page).toHaveURL('/policy');

  await page.getByRole('link', { name: 'Login' }).click();
  await expect(page).toHaveURL('/login');
});

test('unknown route redirects to 404', async ({ mockedPage: page }) => {
  await page.goto('/does-not-exist');
  await expect(page).toHaveURL('/404');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
});
