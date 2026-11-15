# Issue 544: Dev billing validation

## Scope and behavior

Continue the implementation merged in PR #569; do not recreate its prices or migrate existing subscribers. Professional is $24/month or $229/year; Recruiter Pro is $49/month or $469/year. Annual totals are charged after the seven-day trial. Checkout collects a payment method and billing address and enables automatic tax. New checkout subscriptions explicitly cancel at trial end if the payment method is missing.

Use the existing Profile cancellation and billing portal flows. Cancellation at period end retains access through that period. Test missing-payment-method cancellation separately from a declined renewal: they are different Stripe states. A direct Stripe simulation does not prove application webhook reconciliation or customer-facing Checkout behavior.

## Evidence collected on 2026-11-15

- Source baseline: `1bd10281a4415960e660b16298e5b8e8a97c3d76`, fetched from remote main; PR #569 is merged.
- Read only verification of the connected RecruiterReply-Dev sandbox confirmed all four active USD prices, monthly/yearly intervals, and inclusive tax behavior. Dev Tax Settings were active with the existing product classification and existing NC registration. No tax configuration or registrations were changed.
- Created an isolated Dev test clock and two synthetic customers without email addresses or application user mappings. Three subscriptions with Stripe's synthetic Visa payment method and one Professional monthly subscription without a payment method each produced a trialing subscription and an initial invoice with zero amount due. The latter returned `trial_settings.end_behavior.missing_payment_method=cancel`.
- The available Stripe connector search exposes clock creation but no clock advancement operation. Therefore no trial-to-paid, first-renewal, failed-payment recovery, or period-end cancellation result is established by these simulations. All four synthetic subscriptions were canceled without proration or final invoicing; synthetic customer/clock records remain until clock expiry.
- Existing authenticated Dev run [43743538174](https://github.com/moojjoo/recruiterreply/actions/runs/43743538174) has a successful test job. Its four tests cover setup, session access, refresh, and logout, not billing checkout or real Google login.
- Added `tests/e2e/authenticated/billing.spec.ts`, which checks the real Dev catalog and displayed monthly/annual pricing using the existing authenticated setup. It skips Test and does not mutate the QA user's billing state. Test discovery succeeds; execution requires the existing workflow credentials.

## Repeatable verification

Run backend tests, frontend lint/build, the full mocked Playwright suite, dependency vulnerability checks, and existing repository security checks before delivery. The four-plan backend theory verifies payment-method collection, the seven-day trial, automatic tax, and missing-payment-method cancellation.

Run the existing `playwright-authenticated.yml` workflow on the issue branch with `environment=dev`. It consumes the existing six PLAYWRIGHT secrets; never export them to logs or reports. For full checkout acceptance, use a dedicated Dev sandbox account, verify the hosted payment form, disclosed amount/date and no day-one charge, then verify the signed webhook updates the application. Do not submit a real card or change an existing subscriber.

With tooling that supports clock advancement, repeat the synthetic trial using the approved Dev price, advance beyond the trial and invoice finalization, and assert the exact invoice amount and payment status. Repeat with a declined payment method, recovery, and period-end cancellation. Verify application entitlements and duplicate/invalid-signature handling separately. Refund and tax-reversal evidence must also be recorded before claiming those criteria.

## Still open

The issue's latest comments are historical deployment evidence, not proof that every acceptance criterion is met. Full deployed Checkout, renewal/failure/recovery, tax/refund evidence, lifecycle reminders, first-24-hour activation measurement, retained-profit experiment reporting, and Professional Gmail/triage entitlement alignment still require explicit verification or implementation. The current pricing page continues to advertise Professional Gmail sync. Do not silently remove existing entitlements.

The $24/$29 experiment and 90-day pass remain disabled/deferred. Owner approval is still required for experiment activation, final entitlement changes, and any Test/Production work. This continuation does not change workflows, Test/Production, live Stripe, tax registrations, or Gmail messages. Leave #544 open until its remaining acceptance evidence exists.
