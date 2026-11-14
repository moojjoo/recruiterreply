import { test as setup, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { authDirectory, baseURL, storageState } from '../../../playwright.auth.config';

const username = process.env.PLAYWRIGHT_USERNAME;
const password = process.env.PLAYWRIGHT_PASSWORD;
const mfaCode = process.env.PLAYWRIGHT_MFA_CODE;

setup('authenticate with Cognito Hosted UI', async ({ page }) => {
  if (!username || !password) {
    throw new Error('PLAYWRIGHT_USERNAME and PLAYWRIGHT_PASSWORD are required for authenticated validation.');
  }

  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with email' }).click();

  await page.locator('input[name="username"], input[type="email"]').first().fill(username);
  await page.locator('input[name="password"], input[type="password"]').first().fill(password);
  await page.locator('button[name="signInSubmit"], button[type="submit"]').first().click();

  const codeInput = page.locator(
    'input[name="code"], input[name="verification_code"], input[inputmode="numeric"]',
  ).first();
  if (await codeInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    if (!mfaCode) {
      throw new Error('Cognito requested MFA. Provide an approved short-lived PLAYWRIGHT_MFA_CODE through the environment, never in source.');
    }
    await codeInput.fill(mfaCode);
    await page.locator('button[type="submit"], button[name="verifyCode"]').first().click();
  }

  const applicationOrigin = new URL(baseURL).origin;
  await page.waitForURL((url) => (
    url.origin === applicationOrigin &&
    !/^\/(?:login|register)(?:$|[?#])/.test(url.pathname)
  ), { timeout: 30_000 });
  await mkdir(authDirectory, { recursive: true });
  await page.context().storageState({ path: storageState });
});
