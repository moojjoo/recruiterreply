import { test, expect } from '../support/test';
import { testUser } from '../support/fixtures';

const authToken = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('authToken'));

test('register creates an account and lands on dashboard', async ({ mockedPage: page }) => {
  await page.goto('/register');
  await page.getByLabel('Full Name').fill(testUser.name);
  await page.getByLabel('Email').fill(testUser.email);
  await page.getByLabel('Password', { exact: true }).fill('Secret123!');
  await page.getByLabel('Confirm Password').fill('Secret123!');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: `Welcome, ${testUser.name}!` })).toBeVisible();
});

test('register rejects mismatched passwords', async ({ mockedPage: page }) => {
  await page.goto('/register');
  await page.getByLabel('Full Name').fill(testUser.name);
  await page.getByLabel('Email').fill(testUser.email);
  await page.getByLabel('Password', { exact: true }).fill('Secret123!');
  await page.getByLabel('Confirm Password').fill('Different1!');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByRole('alert')).toContainText('Passwords do not match');
  await expect(page).toHaveURL('/register');
});

test('login succeeds and lands on dashboard', async ({ mockedPage: page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(testUser.email);
  await page.getByLabel('Password').fill('Secret123!');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL('/dashboard');
  expect(await authToken(page)).toBe('test-token');
});

test.describe('login failure', () => {
  test.use({ apiRoutes: { 'POST /auth/login': { status: 400, body: { error: 'Invalid credentials' } } } });

  test('shows an error and stays on login', async ({ mockedPage: page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('alert')).toContainText('Login failed');
    await expect(page).toHaveURL('/login');
    expect(await authToken(page)).toBeNull();
  });
});

test('protected route redirects to login without a token', async ({ mockedPage: page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
});

test('logout clears the session', async ({ authedPage: page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText(`Welcome, ${testUser.name}`).first()).toBeVisible();

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL('/login');
  expect(await authToken(page)).toBeNull();
});

test.describe('expired session', () => {
  test.use({ apiRoutes: { 'GET /auth/me': { status: 401, body: {} } } });

  test('401 clears the token and redirects to login', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
    expect(await authToken(page)).toBeNull();
  });
});
