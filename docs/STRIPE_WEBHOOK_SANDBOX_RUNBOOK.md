# Stripe webhook sandbox runbook

Use this runbook independently for Dev and Test. Production is out of scope unless the owner gives a separate explicit command.

## Contract

| Environment | Destination URL | AWS secret |
| --- | --- | --- |
| Dev | `https://api-dev.recruiterreply.com/api/billing/webhook` | `recruiterreply/dev/backend-app-secrets` |
| Test | `https://api-test.recruiterreply.com/api/billing/webhook` | `recruiterreply/test/backend-app-secrets` |

Each destination must use Stripe API version `2025-04-30.basil` and subscribe to exactly:

- `checkout.session.completed`
- `customer.subscription.deleted`
- `customer.subscription.updated`
- `invoice.paid`

The frontend domains (`dev.recruiterreply.com` and `test.recruiterreply.com`) are protected browser surfaces. Do not configure Stripe to use them. Do not use the nonexistent hyphenated domains (`dev-recruiterreply.com` or `test-recruiterreply.com`).

## Safe reconciliation

The reconciliation command reads the existing environment secret in memory, verifies its test-mode Stripe key and expected account ID, and prints only endpoint metadata. It never prints keys or signing secrets. Check mode is the default:

```bash
node scripts/stripe/reconcile-webhook.mjs \
  --environment dev \
  --endpoint-id we_REDACTED
```

Apply only to the environment authorized by the owner:

```bash
node scripts/stripe/reconcile-webhook.mjs \
  --environment dev \
  --endpoint-id we_REDACTED \
  --apply
```

Updating an existing destination preserves its signing secret. If a destination must be recreated, separately update `Stripe:WebhookSecret` in the matching AWS secret, retain the prior secret version for rollback, and restart/deploy only through the approved workflow. Never copy a secret between environments.

## Validation checklist

1. Confirm the selected Stripe sandbox account and test mode.
2. Run the reconciliation command in check mode and verify the URL, API version, and exact four-event allowlist.
3. Probe the route with an invalid signature. Expect HTTP 400 from the application, not an empty 403 from private-origin middleware.
4. Send a valid signed Stripe test-mode event and require HTTP 200–299.
5. Verify the intended subscription or paid-invoice state without recording customer data.
6. Resend the same event and verify the state is unchanged and no duplicate paid-invoice record is created.
7. Record only the environment, event type, truncated event ID, timestamp, HTTP result, and idempotency result.
8. Do not include raw payloads, signing secrets, API keys, customer details, payment data, or full identifiers.

Test and Production promotion remain separately approval-gated. A Dev validation result does not authorize either promotion.

## Account-bound CLI fixtures

Do not run `stripe trigger` directly for release evidence. The CLI can display the logged-in profile even when a separate key was intended, which makes account attribution ambiguous. Use the repository wrapper instead. It reads the selected environment's test key and expected account from AWS Secrets Manager, verifies the account and webhook destination through Stripe's API, and runs the CLI with both an isolated temporary config and `STRIPE_API_KEY`. Temporary state is removed even when validation fails.

Validate configuration without creating an event:

```bash
node scripts/stripe/trigger-fixture.mjs \
  --environment dev \
  --endpoint-id we_REDACTED \
  --event invoice.paid \
  --check
```

Create an allowlisted fixture only after check mode passes:

```bash
node scripts/stripe/trigger-fixture.mjs \
  --environment dev \
  --endpoint-id we_REDACTED \
  --event invoice.paid \
  --trigger
```

For idempotency validation, resend the event through the already verified destination. The wrapper retrieves the event and destination using the same environment key before invoking the CLI:

```bash
node scripts/stripe/trigger-fixture.mjs \
  --environment dev \
  --endpoint-id we_REDACTED \
  --resend-event evt_REDACTED
```

Repeat with `--environment test` and the Test endpoint only when Test validation is separately authorized. Production is intentionally unsupported. Wrapper output is limited to environment, event type, truncated event ID, timestamp, and CLI result; raw CLI output and Stripe secrets are suppressed.
