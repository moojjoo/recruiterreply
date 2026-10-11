import { test, expect } from '../support/test';

test('navigation returns to a light surface after dark to light toggle', async ({ mockedPage: page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => nav.evaluate(element => getComputedStyle(element).backgroundColor)).toMatch(/rgba?\(255, 255, 255(?:, 0\.95)?\)/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('mobile menu returns to white after theme change while open', async ({ mockedPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const menu = page.locator('#primary-navigation-links');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect.poll(() => menu.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect.poll(() => menu.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
});
