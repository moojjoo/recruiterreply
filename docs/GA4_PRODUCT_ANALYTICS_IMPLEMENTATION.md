# GA4 Product Analytics Implementation Map (#303)

## Baseline verified
- `frontend/index.html` initializes gtag and only loads GA4 `G-LRR12SSGH7` on canonical HTTPS production after affirmative analytics consent.
- `frontend/src/components/common/CookieConsent.tsx` persists `rr-cookie-consent-v1`, updates analytics consent, and attempts GA cookie cleanup on withdrawal.
- `docs/GA4_BROWSER_VERIFICATION.md` provides the existing verification procedure.
- Privacy/compliance dependencies: #259 and #260.

## Event contract (proposal; implementation pending)
| Event | Trigger | Parameters |
| --- | --- | --- |
| `sign_up` | Successful account creation | `method` from allowlist |
| `login` | Successful login | `method` from allowlist |
| `analysis_completed` | Successful analysis response | `feature: analyze` |
| `reply_generated` | Successful generation response | `feature: generate` |
| `offer_compared` | Successful comparison response | `feature: compare` |
| `pricing_viewed` | Pricing route view | none |
| `begin_checkout` | Checkout initiated | `plan_tier` from allowlist |
| `purchase` | Confirmed first paid transaction | currency and value only if consented and verified |
| `subscription_cancelled` | Confirmed cancellation | no user/payment identifiers |
| `feature_error` | Expected failure classification | `feature`, `error_category` from allowlists |

Never send user-entered text, resume content, recruiter messages, emails, account identifiers, tokens, URLs with sensitive query strings, Stripe identifiers or generated replies to GA4.

## Work required before claiming completion
1. Inspect React route table, auth handlers, feature completion handlers, checkout and Stripe signed webhook implementation.
2. Build a typed frontend event adapter with strict event/parameter allowlists and production/consent gates; verify no duplicate SPA pageviews.
3. Add safe instrumentation at verified successful outcomes; mock analytics on Dev/Test.
4. Determine whether consent-compatible webhook-to-browser attribution is possible. Otherwise use Stripe for aggregate revenue reporting and disclose the difference from GA4 conversions.
5. Implement unit and Playwright regression tests, GA4 key-event/funnel configuration instructions and Looker Studio dashboard setup.
6. Check GA4 production requests, privacy disclosures and legal review requirements under #260 before any separately approved production promotion.

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
