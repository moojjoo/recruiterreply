# Stripe environment isolation runbook

Issue: #305

RecruiterReply uses one Stripe account with separate named sandboxes for Dev and
Test. Production uses the account's live mode only. Each environment must have
its own products, recurring prices, webhook endpoint, webhook signing secret,
and test customers. Never reuse a Dev/Test customer or webhook secret in another
environment.

## AWS Secrets Manager

Store these values only in the environment-specific secret:

| Environment | Secret name |
| --- | --- |
| Dev | `recruiterreply/dev/backend-app-secrets` |
| Test | `recruiterreply/test/backend-app-secrets` |
| Production | `recruiterreply/prod/backend-app-secrets` |

The Stripe keys are loaded by the backend at startup and are never put in the
frontend, repository, or CI output. The secret must include the equivalent of:

```json
{
  "Stripe:Required": "true",
  "Stripe:Preflight:Enabled": "true",
  "Stripe:ExpectedLiveMode": "false",
  "Stripe:ExpectedAccountId": "acct_sandbox_account",
  "Stripe:SecretKey": "rk_test_redacted",
  "Stripe:WebhookSecret": "whsec_redacted",
  "Stripe:PriceId:Professional": "price_test_redacted",
  "Stripe:PriceId:RecruiterPro": "price_test_redacted"
}
```

Set `Stripe:ExpectedLiveMode` to `false` in Dev/Test and `true` in Production.
The backend also derives this value from `ASPNETCORE_ENVIRONMENT` and rejects a
conflicting setting, so a live key cannot be accepted by Dev/Test and a test
key cannot be accepted by Production. The values above are placeholders; do
not copy them into a real secret.

## Deployment preflight

When preflight is enabled, startup calls Stripe's account and price APIs. It
refuses to start if the key prefix, account ID, account livemode, or either
configured price's livemode disagrees with the environment. Missing required
credentials also fail closed. Validation errors contain no key or secret value.

The application additionally verifies the Stripe signature before processing a
webhook and rejects a validly signed event whose `livemode` does not match the
environment. This protects against accidentally pointing an endpoint at a
different mode even when the signing secret is valid.

## Stripe Dashboard checklist

For each environment, an owner should verify in the matching Stripe Dashboard
context before deployment:

1. Create or select the named sandbox (Dev or Test), then create separate
   products and recurring prices for Professional and Recruiter Pro.
2. Create one webhook endpoint for the deployed environment's `/api/billing/webhook` URL.
3. Subscribe only to the billing events handled by the application and copy
   that endpoint's signing secret into the matching AWS secret.
4. Create a test customer and use Stripe's documented test card in Dev/Test.
5. Confirm the account ID and price IDs in the AWS secret match the Dashboard;
   the preflight checks the API rather than inferring mode from an ID string.

Production setup and promotion remain separately approved owner actions. The
existing build and promotion workflows are not changed by this feature.
