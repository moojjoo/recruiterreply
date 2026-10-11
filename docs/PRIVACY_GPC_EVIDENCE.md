# Issue #260 — Privacy evidence and GPC review

**Status: technical validation in progress; legal review not completed.** This document is a code-derived preliminary inventory, not proof of production runtime behavior or legal compliance.

## Known storage and network behavior (code review)
| Item | Purpose | Consent behavior | Retention / evidence needed |
| --- | --- | --- | --- |
| `rr-cookie-consent-v1` (localStorage) | Save optional analytics choice and timestamp | Written after accept/reject/customize/withdraw | Persists until browser clears storage; confirm live |
| `rr-consent-audit-id-v1` (localStorage) | Random pseudonymous identifier for consent history | Generated on first explicit consent event | Persists until browser clears storage; audit server retention proposed 365 days, pending approval |
| `_ga`, `_ga_*` (cookies) | Optional GA4 usage analytics | Production HTTPS canonical hostname only; should load after opt-in; deletion attempted on withdrawal | Inspect GA4 settings and domain/path variants in production |
| Authentication/session and theme storage | Necessary application functions | Not controlled by optional analytics toggle | Identify exact keys, cookie attributes and expiry on authenticated routes |
| Google sign-in / Gmail OAuth | Optional identity / connected inbox | Only on relevant flows | Capture cookies, SDK requests, OAuth scopes, tokens and vendor retention |
| Stripe checkout / billing | Payment processing | Only on payment flows | Capture Stripe scripts/cookies, purposes, and applicable retention |
| Consent POST `/api/consent-events` | Pseudonymous consent event history | Best-effort after explicit choice; failures must not prevent opting out | PostgreSQL proposed 365 days; backup expiry and deletion rights pending legal review |

The first two keys and GA cookie patterns are established by `frontend/src/components/common/CookieConsent.tsx`. The others are **inventory tasks**, not claims that specific cookies were observed.

## GPC technical decision and legal questions
- The browser signal is detected using `navigator.globalPrivacyControl === true`; the UI displays a notice.
- Google advertising storage, ad user data and ad personalization are denied in the consent implementation. Optional analytics is separately controlled by affirmative user choice.
- **GPC is not automatically equivalent to refusing all analytics in every jurisdiction.** Counsel must assess applicable sale/share, targeted-advertising and universal opt-out obligations, whether vendors qualify, and whether GPC must override a previously saved choice for any covered processing.
- Do not state that the site is legally GPC-compliant until these questions are resolved and production behavior is validated.

## Runtime evidence checklist (manual; redact secrets and PII)
1. In a clean browser profile, visit canonical production homepage, /policy, /cookies, login/register and dashboard. Repeat before consent, after rejection, after acceptance and after withdrawal.
2. Record DevTools Application > Cookies/localStorage/sessionStorage names, domains, paths, expiration and SameSite/Secure/HttpOnly attributes. Avoid exporting token values.
3. Record third-party network **hostnames** and purposes (Google, Gmail, Stripe and other vendors), without request payloads or auth headers. Repeat Google sign-in, Gmail connect and checkout in appropriate sandbox/test flows.
4. Repeat with GPC enabled and disabled; inspect Google consent updates and ensure covered sale/share or targeted-advertising opt-outs are honored as counsel determines.
5. Confirm GA4 is gated to HTTPS `recruiterreply.com` after affirmative analytics consent, and verify withdrawal removes feasible first-party analytics cookies. Verify production GA4 property retention settings.
6. Confirm `privacy@recruiterreply.com` is monitored and privacy request procedures are operational.
7. Review PostgreSQL consent event retention, backups, deletion request workflow and logging; reconcile public disclosures with actual configuration.
8. Obtain qualified legal review for applicable jurisdictions and policy language; retain dated approval and evidence.

## Sign-off
- [ ] Production unauthenticated and authenticated inventory captured
- [ ] Google sign-in, Gmail and Stripe flows inventoried
- [ ] GPC obligations and precedence signed off by qualified counsel
- [ ] Cookie Policy and Privacy Policy reconciled with measured vendor behavior, consent audit retention and user rights
- [ ] Accessibility / equal-effort reject and withdrawal verified
- [ ] Security review confirms no secrets or identifying request data in consent audit logs

No deployment or Test/Production promotion authorized by issue #260.
