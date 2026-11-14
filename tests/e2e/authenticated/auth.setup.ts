import { test as setup, expect, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { authDirectory, baseURL, storageState } from '../../../playwright.auth.config';
import { generateTotp } from './totp';

const perimeterUsername = process.env.PLAYWRIGHT_USERNAME;
const perimeterPassword = process.env.PLAYWRIGHT_PASSWORD;
const perimeterTotpSecret = process.env.PLAYWRIGHT_TOTP_SECRET;
const applicationUsername = process.env.PLAYWRIGHT_APP_USERNAME || perimeterUsername;
const applicationPassword = process.env.PLAYWRIGHT_APP_PASSWORD || perimeterPassword;
const applicationTotpSecret = process.env.PLAYWRIGHT_APP_TOTP_SECRET || perimeterTotpSecret;
const lastTotpCodes = new Map<string, string>();

async function visibleInput(page: Page, selectors: string, timeout = 0) {
  const deadline = Date.now() + timeout;
  do {
    const matches = page.locator(selectors);
    for (let index = 0; index < await matches.count(); index += 1) {
      const match = matches.nth(index);
      if (await match.isVisible().catch(() => false)) return match;
    }
    if (Date.now() < deadline) await page.waitForTimeout(250);
  } while (Date.now() < deadline);

  throw new Error(`No visible control matched: ${selectors}`);
}

async function freshTotpCode(secret: string, label: string): Promise<string> {
  const key = `${label}:${secret}`;
  let code = generateTotp(secret);
  if (lastTotpCodes.get(key) === code) {
    const remaining = 30_000 - (Date.now() % 30_000) + 250;
    await new Promise((resolve) => setTimeout(resolve, remaining));
    code = generateTotp(secret);
  }
  lastTotpCodes.set(key, code);
  return code;
}

async function completeCognitoLogin(
  page: Page,
  username: string | undefined,
  password: string | undefined,
  totpSecret: string | undefined,
  label: string,
) {
  if (!username || !password) {
    throw new Error(
      `${label} credentials are required. Configure the appropriate GitHub Environment secrets without storing them in source.`,
    );
  }

  await (await visibleInput(page, 'input[name="username"], input[type="email"]')).fill(username);
  await (await visibleInput(page, 'input[name="password"], input[type="password"]')).fill(password);
  await (await visibleInput(
    page,
    'button[name="signInSubmit"], button[type="submit"], input[name="signInSubmit"], input[type="submit"]',
  )).click();

  let codeInput: Locator | undefined;
  try {
    codeInput = await visibleInput(
      page,
      'input[name="code"], input[name="verification_code"], input[name="software_token_mfa_code"], input[inputmode="numeric"]',
      5_000,
    );
  } catch {
    codeInput = undefined;
  }
  if (codeInput) {
    if (!totpSecret) {
      throw new Error(
        `${label} requested MFA, but its TOTP seed is not configured. Configure the appropriate GitHub Environment secret.`,
      );
    }
    await codeInput.fill(await freshTotpCode(totpSecret, label));
    await (await visibleInput(
      page,
      'button[name="verifyCode"], button[type="submit"], input[type="submit"]',
    )).click();
  }
}

setup('authenticate with Cognito Hosted UI', async ({ page }) => {
  if (!perimeterUsername || !perimeterPassword) {
    throw new Error('PLAYWRIGHT_USERNAME and PLAYWRIGHT_PASSWORD are required for perimeter validation.');
  }

  const applicationOrigin = new URL(baseURL).origin;
  await page.goto('/login');

  // The private edge may redirect directly to its native Cognito UI. This
  // account must never use Google or any other external identity provider.
  if (new URL(page.url()).origin === applicationOrigin) {
    throw new Error('The protected environment did not redirect to its perimeter Cognito sign-in.');
  }
  await completeCognitoLogin(
    page,
    perimeterUsername,
    perimeterPassword,
    perimeterTotpSecret,
    'Perimeter',
  );
  await page.waitForURL((url) => url.origin === applicationOrigin, { timeout: 30_000 });

  // The perimeter session only grants access to the deployed application. It
  // is intentionally separate from the application's own user session.
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with email' })).toBeVisible();
  // The button first requests an authorization URL from the BFF and then
  // assigns window.location. Wait for the hosted-login or final dashboard
  // navigation before
  // looking for Cognito's controls; otherwise the old app page is still
  // active and the test races the browser navigation.
  await Promise.all([
    page.waitForURL((url) => (
      url.origin !== applicationOrigin ||
      !/^\/(?:login|register)(?:$|[?#])/.test(url.pathname)
    ), { timeout: 30_000 }),
    page.getByRole('button', { name: 'Continue with email' }).click(),
  ]);

  if (new URL(page.url()).origin !== applicationOrigin) {
    await completeCognitoLogin(
      page,
      applicationUsername,
      applicationPassword,
      applicationTotpSecret,
      'Application',
    );
  }

  await page.waitForURL((url) => (
    url.origin === applicationOrigin &&
    !/^\/(?:login|register)(?:$|[?#])/.test(url.pathname)
  ), { timeout: 30_000 });
  await mkdir(authDirectory, { recursive: true });
  await page.context().storageState({ path: storageState });
});
