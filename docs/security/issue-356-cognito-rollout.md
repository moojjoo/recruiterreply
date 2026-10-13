# Issue #356 — Dev/Test Cognito access protection (work in progress)

**State: NOT ENFORCED.** The identity module in this branch is intentionally not wired into the active Terraform roots. No deployment or access restriction is implied by this PR. Do not merge or apply it as a complete solution.

## Selected experience
1. Visit dev.recruiterreply.com or test.recruiterreply.com.
2. An edge gate redirects an unauthenticated visitor to the corresponding AWS Cognito managed login.
3. Enter the invite-only account password and then a one-time code sent to the verified email address.
4. After successful authorization, return to the original URL using a secure server-side callback and a short-lived HttpOnly, Secure, SameSite cookie.
5. Logout revokes session and clears cookies. Session validation must happen **before CloudFront serves any cached object**.

The user prefers a code that is easy to select/copy. HTML email must show a prominent selectable code; scripts and clipboard buttons are not reliable inside email clients. Never promise an email-native clipboard button. A functional copy control may be provided on a secure HTTPS web page if it does not expose the OTP in a URL, logs or analytics.

## Security and implementation blockers before enabling
- Confirm current CloudFront plan and Lambda@Edge support. Implement a tested viewer-request edge gate for **all** Dev/Test paths, including assets, prerendered pages, errors, CloudFront default distribution hostnames and deep links. No cached content may bypass authorization.
- Preserve the existing Dev viewer-request SPA rewrite (CloudFront allows one function per event type; move/combine logic safely) and Dev/Test viewer-response noindex.
- Integrate a verified authorization-code + PKCE flow, nonce/state validation, JWKS signature validation, issuer/audience checks, expiration, secure callback, and session renewal/revocation. Avoid client-side-only protection or a public unauthenticated token endpoint.
- Configure SES verified identity, approved From address and delivery permissions. Verify Cognito Essentials tier, email OTP MFA feature support in the pinned AWS provider and region, actual cost, and email deliverability. Email MFA with password is **two factors**; email-only passwordless OTP is not.
- Review account recovery: Cognito email MFA cannot use the same email address for self-service password recovery. Document secure administrator-assisted recovery or a separately verified recovery factor.
- Add read-only live AWS audit and a reviewed Terraform plan before wiring the module. Never run apply from the draft PR.
- Coordinate with #357: the API needs independent access enforcement, including direct EC2 IP/alternate hostname and port bypass; CORS is not a security boundary.
- Do not break GitHub Actions promotions or SEO smoke tests; define least-privilege, short-lived noninteractive test access.
- Do not change Production frontend distribution or Production sign-in.

## Mandatory validation before requesting approval
- Unauthenticated GET/HEAD to /, /index.html, /assets/*, /robots.txt, /sitemap.xml, /register, arbitrary deep links, and direct CloudFront hostname must never return application content.
- Authorized Cognito password + email MFA user can browse, reload deep links, sign out, and recover from expired sessions.
- Missing/forged/expired cookies, wrong environment token, forged callback state, invalid code, and cross-user attempts are rejected.
- Confirm edge cache behavior and CloudFront 403/404 SPA fallback do not turn denials into 200 application responses.
- Confirm Test/Dev noindex and Production public behavior unchanged.
- Verify SES email delivery, account invitation, MFA enrollment, and recovery; capture costs and rollback.
- Obtain explicit approval before Terraform apply, merge, Test promotion or Production change.

## Rollback
Preserve the current CloudFront distribution IDs, function associations and Terraform state. Review and rehearse a Terraform plan that restores original viewer-request routing and removes the gate without changing OAC, aliases or production. Revoke any created Cognito sessions when decommissioning.
