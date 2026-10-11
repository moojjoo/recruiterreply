# GA4 privacy and browser verification (#258)

## Automated CI
Playwright runs against a locally served production frontend build with mocked API calls; it does **not** send traffic to live production. `tests/e2e/cookie-consent.spec.ts` checks pre-consent denial, rejection, acceptance/customization, persistence, withdrawal, cookie cleanup, GPC notice, keyboard/mobile behavior, authenticated route and no analytics traffic on localhost.

The canonical production hostname gate is checked in the frontend source. This is **not a substitute** for a full browser run on production; tests on localhost cannot prove that the real GA4 endpoint receives hits on the actual production origin. A simulated hostname test is a static guard, not a network-level guarantee. A follow-up integration test should use a dedicated local HTTPS reverse proxy or Playwright origin override to exercise all hostnames.

## Manual verification before Production approval
1. In Chrome Incognito, open `https://recruiterreply.com`. DevTools > Network > Preserve log; filter `gtag/js|google-analytics.com|collect`. Do not accept cookies. Verify zero GA4 network requests and denied Consent Mode v2 defaults.
2. Reject optional analytics, navigate public and authenticated pages and reload. Verify no GA4 network requests.
3. Open Cookie Settings, accept analytics. Confirm one `gtag/js?id=G-LRR12SSGH7` request and GA4 collection request; check GA4 Realtime using a consenting test visitor. Do not use synthetic customer PII.
4. Inspect GA4 requests for `page_location`, `page_title`, `user_id`, query parameters and custom event payloads. No emails, names, resumes, recruiter message text, generated replies, payment identifiers, access tokens or other PII.
5. Withdraw consent; verify no further collection after reload, GA cookies cleared when feasible, and the choice remains denied. Note: in-flight requests and third-party cookie restrictions can affect observed behavior.
6. Repeat the consent flows on `https://dev.recruiterreply.com` and `https://test.recruiterreply.com`; even accepted or previously saved consent must yield zero GA4 script/collect requests.
7. Validate GPC opt-out obligations by jurisdiction, cookie inventory and policy wording with legal/privacy review (#260). GPC alone does not automatically settle all analytics consent requirements.
8. Check keyboard navigation, screen-reader labeling and mobile display. Record browser version, timestamp, hostname, requests observed, and release SHA.

No Test/Prod promotion is authorized by this issue. Production manual checks require a separate authorized release and privacy review.
