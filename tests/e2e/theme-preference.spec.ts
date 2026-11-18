import { test, expect } from '../support/test';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`fresh visitor defaults dark with ${colorScheme} OS preference`, async ({ mockedPage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('recruiterreply-theme'))).toBeNull();
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`saved ${theme} choice survives load and reload`, async ({ mockedPage: page }) => {
    await page.addInitScript(value => localStorage.setItem('recruiterreply-theme', value), theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  });
}

test('invalid preference defaults dark without rewriting storage', async ({ mockedPage: page }) => {
  await page.addInitScript(() => localStorage.setItem('recruiterreply-theme', 'invalid'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('recruiterreply-theme'))).toBe('invalid');
});

test('unavailable theme storage still renders and toggles', async ({ mockedPage: page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'recruiterreply-theme') throw new DOMException('Unavailable', 'SecurityError');
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'recruiterreply-theme') throw new DOMException('Unavailable', 'SecurityError');
      return set.call(this, key, value);
    };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('toggle persists through reload and other tabs synchronize changes and removal', async ({ mockedPage: page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const other = await context.newPage();
  // Static same-origin document can mutate storage without making application API calls.
  await other.goto('/robots.txt');
  await other.evaluate(() => localStorage.setItem('recruiterreply-theme', 'dark'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await other.evaluate(() => localStorage.setItem('recruiterreply-theme', 'light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.evaluate(() => localStorage.removeItem('recruiterreply-theme'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await other.evaluate(() => localStorage.setItem('recruiterreply-theme', 'light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.evaluate(() => localStorage.clear());
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await other.close();
});
