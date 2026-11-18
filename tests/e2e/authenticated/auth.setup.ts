import { test as setup, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { authDirectory, baseURL, storageStates } from '../../../playwright.auth.config';
import { generateTotp } from './totp';

const perimeterUsername = process.env.PLAYWRIGHT_USERNAME;
const perimeterPassword = process.env.PLAYWRIGHT_PASSWORD;
const perimeterTotpSecret = process.env.PLAYWRIGHT_TOTP_SECRET;
const applicationUsername = process.env.PLAYWRIGHT_APP_USERNAME || perimeterUsername;
const applicationPassword = process.env.PLAYWRIGHT_APP_PASSWORD || perimeterPassword;
const applicationTotpSecret = process.env.PLAYWRIGHT_APP_TOTP_SECRET || perimeterTotpSecret;
const lastTotpCodes = new Map<string, string>();
const allowedAuthHosts = new Set((process.env.PLAYWRIGHT_ALLOWED_AUTH_HOSTS || '')
  .split(',')
  .map(host => host.trim())
  .filter(Boolean));

function assertCredentialDestination(page: Page, label: string) {
  if (allowedAuthHosts.size === 0) {
    throw new Error('PLAYWRIGHT_ALLOWED_AUTH_HOSTS must contain exact approved Cognito hostnames.');
  }
  for (const host of allowedAuthHosts) {
    if (!/^[a-z0-9-]+\.auth\.[a-z0-9-]+\.amazoncognito\.com$/.test(host)) {
      throw new Error('PLAYWRIGHT_ALLOWED_AUTH_HOSTS contains an invalid hostname.');
    }
  }
  const destination = new URL(page.url());
  if (destination.protocol !== 'https:' || destination.username || destination.password ||
      destination.port || !allowedAuthHosts.has(destination.hostname)) {
    throw new Error(`${label} credential destination is not allowlisted.`);
  }
}

function isAllowedCredentialDestination(url: URL) {
  return url.protocol === 'https:' && !url.username && !url.password &&
    !url.port && allowedAuthHosts.has(url.hostname);
}

function isAuthenticatedApplicationDestination(url: URL, applicationOrigin: string) {
  return url.origin === applicationOrigin &&
    !/^\/(?:login|register)(?:$|[?#])/.test(url.pathname + url.search + url.hash);
}

async function waitForApprovedNavigation(
  page: Page,
  predicate: (url: URL) => boolean,
  label: string,
) {
  try {
    await page.waitForURL(predicate, { timeout: 30_000, waitUntil: 'commit' });
  } catch {
    // Playwright's navigation diagnostics include the complete URL. OAuth
    // callbacks contain one-time code/state values, so replace those details
    // with a stable failure message before the reporter can print them.
    throw new Error(`${label} did not reach an approved destination.`);
  }
}

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

async function freshTotpCode(secret: string): Promise<string> {
  // Cognito rejects reuse for the same seed even when separate application
  // sessions are being prepared. Track the seed, not the human-readable
  // session label, so independently authenticated fixtures never reuse a
  // still-current code.
  const key = secret;
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

  assertCredentialDestination(page, label);

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
    await codeInput.fill(await freshTotpCode(totpSecret));
    await (await visibleInput(
      page,
      'button[name="verifyCode"], button[type="submit"], input[type="submit"]',
    )).click();
  }
}

async function authenticateSession(
  page: Page,
  testInfo: TestInfo,
  sessionLabel: string,
  storageStatePath: string,
) {
  // Each fixture authenticates both security boundaries. When both layers
  // intentionally share a TOTP seed, freshTotpCode can wait across two code
  // windows before Cognito/network latency is considered.
  setup.setTimeout(180_000);
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
  if (testInfo.retry > 0 && (perimeterTotpSecret || applicationTotpSecret)) {
    // A failed attempt can consume the current one-time code. A retry runs in
    // a fresh worker, so deliberately cross the TOTP boundary before reuse.
    await new Promise(resolve => setTimeout(resolve, 30_000 - (Date.now() % 30_000) + 250));
  }
  await completeCognitoLogin(
    page,
    perimeterUsername,
    perimeterPassword,
    perimeterTotpSecret,
    `Perimeter (${sessionLabel})`,
  );
  await page.waitForURL((url) => url.origin === applicationOrigin, { timeout: 30_000 });

  // The perimeter session only grants access to the deployed application. It
  // is intentionally separate from the application's own user session.
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with email' })).toBeVisible();
  // The button first requests an authorization URL from the BFF and then
  // assigns window.location. Resolve as soon as an approved navigation is
  // committed: a warm Cognito session can immediately continue through the
  // BFF callback before the hosted page reaches its load event. Waiting for
  // that transient page to load would miss it and leave this promise blocked
  // on the (deliberately untrusted for credentials) API callback origin.
  await Promise.all([
    waitForApprovedNavigation(page, (url) => (
      isAllowedCredentialDestination(url) ||
      isAuthenticatedApplicationDestination(url, applicationOrigin)
    ), 'Application login'),
    page.getByRole('button', { name: 'Continue with email' }).click(),
  ]);

  if (isAllowedCredentialDestination(new URL(page.url()))) {
    await completeCognitoLogin(
      page,
      applicationUsername,
      applicationPassword,
      applicationTotpSecret,
      `Application (${sessionLabel})`,
    );
  }

  await waitForApprovedNavigation(page, (url) => (
    isAuthenticatedApplicationDestination(url, applicationOrigin)
  ), 'Cognito callback');
  await mkdir(authDirectory, { recursive: true });
  await page.context().storageState({ path: storageStatePath });
}

for (const [sessionLabel, storageStatePath] of Object.entries(storageStates)) {
  setup(`authenticate ${sessionLabel} session with Cognito Hosted UI`, async ({ page }, testInfo) => {
    await authenticateSession(page, testInfo, sessionLabel, storageStatePath);
  });
}
