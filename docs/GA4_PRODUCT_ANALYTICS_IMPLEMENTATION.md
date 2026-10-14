# GA4 Product Analytics Implementation Map (#303)

## Baseline verified
- `frontend/index.html` initializes gtag and only loads GA4 `G-LRR12SSGH7` on canonical HTTPS production after affirmative analytics consent.
- `frontend/src/components/common/CookieConsent.tsx` persists `rr-cookie-consent-v1`, updates analytics consent, and attempts GA cookie cleanup on withdrawal.
- `docs/GA4_BROWSER_VERIFICATION.md` provides the existing verification procedure.
- Privacy/compliance dependencies: #259 and #260.

## Event contract (implemented frontend contract)
| Event | Trigger | Parameters |
| --- | --- | --- |
| `sign_up` | Successful account creation | `method` from allowlist |
| `login` | Successful login | `method` from allowlist |
| `analysis_completed` | Successful analysis response | `feature: analyze` |
| `reply_generated` | Successful generation response | `feature: generate` |
| `offer_compared` | Successful comparison response | `feature: compare` |
| `pricing_viewed` | Pricing route view | none |
| `begin_checkout` | Checkout initiated | `plan_tier` from allowlist |
| `purchase` | Not emitted to GA4; see Stripe limitation below | n/a |

Never send user-entered text, resume content, recruiter messages, emails, account identifiers, tokens, URLs with sensitive query strings, Stripe identifiers or generated replies to GA4.

The typed adapter accepts only the parameters shown above. `sign_up`, password/Google `login`, and the three AI events fire after successful application responses. `begin_checkout` fires only after the backend creates a Stripe Checkout session. `pricing_viewed` and sanitized `page_view` events are emitted from the React router. Query strings, fragments, user input, identifiers and payment data are not accepted by the API.

`frontend/index.html` configures GA4 with `send_page_view: false`; the router is the sole page-view source. Consecutive duplicate paths are suppressed while a later return to a route remains countable. All events fail closed unless the page is `https://recruiterreply.com` and version-1 analytics consent is affirmative. Dev/Test cannot override that gate.

## Release constraints
This document is an implementation checkpoint, **not** finished instrumentation or deployment. Keep Test and Production explicitly approval-gated. Do not auto-merge until functional code and CI validation are complete.

## GA4 property configuration (user-reported)
- Production web stream measurement ID: `G-LRR12SSGH7`.
- The user reports configuring GA4 key events: `sign_up`, `analysis_completed`, `reply_generated`, `offer_compared`, and `purchase`. **Not independently verified through GA4 Admin.**
- The application must emit these names exactly, only after their corresponding verified success condition and affirmative analytics consent on the production hostname.
- GA4 Admin configuration is external to this repository: this section documents the intended contract; it does not synchronize Google Analytics settings or prove any events have been received.
- `purchase` must not be emitted merely on checkout redirect. Implement webhook-confirmed, deduplicated, consent-compatible conversion reporting or document why attribution cannot safely be achieved.

## Stripe purchase event: verified implementation constraint
The existing `BillingService.CreateCheckoutSessionAsync` creates subscriptions with a **7-day trial**. The signed webhook handles `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`; it does **not** currently process `invoice.paid`. A completed checkout is not proof of a paid invoice. **Do not emit GA4 `purchase` from checkout completion or from a `?checkout=success` query parameter.**

A future server-side paid conversion implementation requires:
1. Process verified `invoice.paid` (or the Stripe API-version-appropriate paid-invoice event) with a persisted unique Stripe invoice/event ID to deduplicate webhook retries; confirm positive paid amount, currency and subscription status.
2. Define whether the metric is first paid subscription, renewals, or both, and distinguish trial starts separately from purchases.
3. Design privacy-compliant attribution: the backend cannot assume consent or recover a GA client ID from a Stripe webhook. Do not send email, user ID, Stripe customer ID, subscription ID, or invoice ID to GA4. Do not persist or transmit analytics identifiers without the required consent and policy review.
4. If compliant GA4 attribution cannot be established, keep `purchase` unimplemented and report verified paid invoices/revenue through Stripe aggregates instead. Never manufacture browser-side purchase events on the success URL.

## GA4 configuration and dashboard steps
- The user reports creating key events `sign_up`, `analysis_completed`, `reply_generated`, `offer_compared`, and `purchase` in the GA4 property `G-LRR12SSGH7`.
- In GA4 Explorations, create a funnel: `sign_up` → `analysis_completed` → `reply_generated`; create a separate path for `offer_compared`. Events will only populate after separately approved production deployment and consented real usage.
- Connect the GA4 property to Looker Studio for daily event counts and funnel steps; use Stripe as the authoritative revenue source until verified, consent-compatible paid conversion attribution exists.
- Validate using GA4 DebugView and browser Network tab after opt-in on production; reject/withdraw and verify no subsequent event collection. Never enable GA4 on Dev/Test to force test data into production analytics.

### Funnel and retention definitions

- Acquisition: consented sessions grouped by GA4's session default channel group. Opted-out visitors are absent from the denominator.
- Activation: unique consented users with `sign_up` followed by at least one of `analysis_completed`, `reply_generated`, or `offer_compared`.
- Checkout intent: unique consented users with `begin_checkout`; this is not revenue and must not be labeled purchase.
- Paid conversion/revenue: count and sum eligible rows in `stripe_paid_invoices`. Stripe is authoritative and cannot be joined to GA4 users under the current privacy design.
- Retention: GA4 consented-user cohorts returning in weeks 1, 4, and 8 with at least one successful AI-feature event. This is product-event retention, not paid retention.

### Looker Studio setup

1. Add the GA4 property as one data source and Stripe's approved aggregate export as a separate data source. Do not upload customer- or invoice-level identifiers.
2. Create scorecards for consented sessions, sign-ups, activated users, checkout intent, and Stripe-confirmed paid invoices. Label GA4 cards “consented traffic only.”
3. Create a GA4 funnel for `sign_up` → any successful AI event → `begin_checkout`. Display Stripe paid conversion separately; do not blend it into a user-level funnel.
4. Add feature-adoption time series for the three bounded AI events and cohort tables for weeks 1, 4, and 8.
5. Record the property, report owner, date range, filters, and last validation date in the dashboard description. No dashboard provisioning credentials belong in this repository.

### Remaining external validation gates

- #260 remains the dependency for jurisdiction/GPC policy review and production disclosures.
- GA4 Admin key-event/custom-dimension configuration and Looker Studio creation are external manual steps; repository code cannot prove them complete.
- Production browser Realtime/DebugView validation requires separate Production approval. Dev validation proves the negative control only: no production GA traffic is sent.

## Paid invoice implementation checkpoint (PR #304)
- Additive migration `20261011170000_AddStripePaidInvoices` creates `stripe_paid_invoices` with a unique `stripe_invoice_id`; review SQL and take a database backup before deployment. Note: Dev/Test may auto-apply migrations on startup when `Database:AutoMigrate=true`.
- `BillingService` now handles signed `invoice.paid` webhooks and uses parameterized `INSERT ... ON CONFLICT (stripe_invoice_id) DO NOTHING` to persist positive paid subscription invoices only. No GA4 purchase event is emitted.
- Unit tests cover paid, zero-dollar, unpaid and non-subscription eligibility. **Still required before ready-for-review:** compile/CI validation against the pinned Stripe.NET invoice model, integration tests against PostgreSQL for sequential and concurrent duplicate signed webhook deliveries, Stripe test-mode webhook validation, and migration preflight/recovery review.
- For the Stripe webhook endpoint to receive these events, subscribe it to `invoice.paid` in the Stripe dashboard for each approved environment. Do not configure production until production approval.
