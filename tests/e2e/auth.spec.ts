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
  await expect(page.getByRole('status')).toContainText('Passwords do not match');
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

const fillRegistration = async (page: import('@playwright/test').Page) => {
  await page.goto('/register');
  await page.getByLabel('Full Name').fill('Jane Tester');
  await page.getByLabel('Email').fill('jane@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Secret123!');
  await page.getByLabel('Confirm Password').fill('Secret123!');
  await page.getByRole('button', { name: 'Create Account' }).click();
};

test.describe('registration API failures', () => {
  test.describe('duplicate account', () => {
    test.use({ apiRoutes: { 'POST /auth/register': { status: 409, body: { error: 'A user with this email already exists.' } } } });
    test('shows backend conflict explanation', async ({ mockedPage: page }) => {
      await fillRegistration(page);
      await expect(page.getByRole('alert')).toContainText('A user with this email already exists.');
      await expect(page).toHaveURL('/register');
      await expect(page.getByLabel('Email')).toHaveValue('jane@example.com');
    });
  });
  test.describe('invalid registration', () => {
    test.use({ apiRoutes: { 'POST /auth/register': { status: 400, body: { error: 'Email and password are required.' } } } });
    test('shows safe validation details', async ({ mockedPage: page }) => {
      await fillRegistration(page);
      await expect(page.getByRole('alert')).toContainText('Email and password are required.');
    });
  });
  test.describe('server failure', () => {
    test.use({ apiRoutes: { 'POST /auth/register': { status: 500, body: { error: 'internal stack trace secret' } } } });
    test('does not expose server internals', async ({ mockedPage: page }) => {
      await fillRegistration(page);
      await expect(page.getByRole('alert')).toContainText('Registration is temporarily unavailable.');
      await expect(page.getByRole('alert')).not.toContainText('stack trace');
    });
  });
  test.describe('throttled', () => {
    test.use({ apiRoutes: { 'POST /auth/register': { status: 429, body: {} } } });
    test('shows retry guidance', async ({ mockedPage: page }) => {
      await fillRegistration(page);
      await expect(page.getByRole('alert')).toContainText('Too many attempts.');
    });
  });
});

test('registration network failure displays actionable message', async ({ mockedPage: page }) => {
  await page.route('**/api/auth/register', route => route.abort('failed'));
  await fillRegistration(page);
  await expect(page.getByRole('alert')).toContainText('Unable to connect to the registration service.');
  await expect(page).toHaveURL('/register');
});

test('error toast has WCAG AA text contrast in light and dark themes', async ({ mockedPage: page }) => {
  await page.goto('/register');
  const contrast = (fg: number[], bg: number[]) => {
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map(v => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = luminance(fg), b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const rgb = (value: string) => [...value.matchAll(/[\\d.]+/g)].slice(0, 3).map(m => Number(m[0]));
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
    await page.getByLabel('Password', { exact: true }).fill('Secret123!');
    await page.getByLabel('Confirm Password').fill('Wrong123!');
    await page.getByLabel('Full Name').fill('Jane Tester');
    await page.getByLabel('Email').fill('jane@example.com');
    await page.getByRole('button', { name: 'Create Account' }).click();
    const alert = page.locator('.alert-error').last();
    await expect(alert).toBeVisible();
    const colors = await alert.evaluate(el => {
      const css = getComputedStyle(el);
      return { fg: css.color, bg: css.backgroundColor };
    });
    expect(contrast(rgb(colors.fg), rgb(colors.bg)), theme + ' toast contrast').toBeGreaterThanOrEqual(4.5);
  }
});
