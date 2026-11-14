import { test as setup, expect, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { authDirectory, baseURL, storageState } from '../../../playwright.auth.config';

const perimeterUsername = process.env.PLAYWRIGHT_USERNAME;
const perimeterPassword = process.env.PLAYWRIGHT_PASSWORD;
const perimeterMfaCode = process.env.PLAYWRIGHT_MFA_CODE;
const applicationUsername = process.env.PLAYWRIGHT_APP_USERNAME || perimeterUsername;
const applicationPassword = process.env.PLAYWRIGHT_APP_PASSWORD || perimeterPassword;
const applicationMfaCode = process.env.PLAYWRIGHT_APP_MFA_CODE || perimeterMfaCode;

async function visibleInput(page: Page, selectors: string) {
  const matches = page.locator(selectors);
  for (let index = 0; index < await matches.count(); index += 1) {
    const match = matches.nth(index);
    if (await match.isVisible().catch(() => false)) return match;
  }
  throw new Error(`No visible control matched: ${selectors}`);
}

async function completeCognitoLogin(
  page: Page,
  username: string | undefined,
  password: string | undefined,
  mfaCode: string | undefined,
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
      'input[name="code"], input[name="verification_code"], input[inputmode="numeric"]',
    );
  } catch {
    codeInput = undefined;
  }
  if (codeInput) {
    if (!mfaCode) {
      throw new Error(
        `${label} requested MFA. Provide an approved short-lived MFA code through the environment, never in source.`,
      );
    }
    await codeInput.fill(mfaCode);
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
  await completeCognitoLogin(page, perimeterUsername, perimeterPassword, perimeterMfaCode, 'Perimeter');
  await page.waitForURL((url) => url.origin === applicationOrigin, { timeout: 30_000 });

  // The perimeter session only grants access to the deployed application. It
  // is intentionally separate from the application's own user session.
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with email' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with email' }).click();

  await completeCognitoLogin(
    page,
    applicationUsername,
    applicationPassword,
    applicationMfaCode,
    'Application',
  );

  await page.waitForURL((url) => (
    url.origin === applicationOrigin &&
    !/^\/(?:login|register)(?:$|[?#])/.test(url.pathname)
  ), { timeout: 30_000 });
  await mkdir(authDirectory, { recursive: true });
  await page.context().storageState({ path: storageState });
});
