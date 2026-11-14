# Authenticated Dev/Test Playwright validation

The repository has two Playwright entry points:

- `npm run test:e2e` runs the local frontend regression suite with mocked API responses.
- `npx playwright test --config=playwright.auth.config.ts` runs a real browser session against a deployed Dev or Test site.

## Local authenticated run

Use a dedicated lower-environment account. Do not use a personal account or save credentials in the repository.

```bash
export PLAYWRIGHT_ENV=dev
export BASE_URL=https://dev.recruiterreply.com
export PLAYWRIGHT_USERNAME='lower-environment-test-user@example.com'
export PLAYWRIGHT_PASSWORD='use-a-local-secret-store'
npx playwright install chromium
npx playwright test --config=playwright.auth.config.ts
```

If Cognito requests email MFA, provide the current one-time code through `PLAYWRIGHT_MFA_CODE` for that run only. Do not place an OTP in source, a committed `.env` file, a test fixture, a URL, or a persistent artifact. The default storage state is written under the operating system temporary directory. Override `PLAYWRIGHT_AUTH_DIR` only with a local ignored directory.

The authenticated setup stores only the browser state needed by the dependent tests. Delete the temporary directory after use and never upload it. Playwright reports may contain screenshots and traces, but must not contain credentials, tokens, authorization codes, or storage state.

## GitHub Actions

`.github/workflows/playwright-authenticated.yml` runs automatically after successful Dev/Test deployment statuses and can also be dispatched manually. Configure these secrets separately in the GitHub `dev` and `test` Environments:

- `PLAYWRIGHT_USERNAME`
- `PLAYWRIGHT_PASSWORD`
- `PLAYWRIGHT_MFA_CODE` only when an approved, short-lived code-injection process exists

Use dedicated invited accounts with the minimum lower-environment access. A static MFA code is not acceptable. If the environment requires interactive email verification, the job must fail with a clear prerequisite message rather than weakening MFA or guessing a code.

The workflow does not upload the temporary authentication directory. It retains only the HTML report, screenshots, and traces needed to diagnose a failed run.

## Codex interactive browser validation

For Codex-driven interactive validation, enable the `js_repl` feature in the Codex configuration and start a new Codex session. Use a persistent, isolated Playwright browser context for the selected environment, and keep credentials and storage state outside the repository. The interactive session and the GitHub Actions workflow are separate validation paths: interactive Codex work is useful for investigation and guided acceptance, while CI provides repeatable post-deployment evidence.

Never paste credentials into chat, commit browser state, or reuse a Production account. Dev and Test remain the only environments covered by this workflow; Production requires a separate owner command.
