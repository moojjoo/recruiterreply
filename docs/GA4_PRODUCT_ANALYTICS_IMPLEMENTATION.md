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
