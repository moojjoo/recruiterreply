# Issue #444 — Authentication email integration checklist

The shared `VerificationEmailTemplate` renderer is **presentation-only**. No message delivery, verification-code generation, authentication, or user account activation behavior is changed by this initial commit.

## Integration prerequisites
1. **Signup:** Current `AuthController.Register` immediately creates an active account and issues a JWT. Design a verified-email enrollment state and provider-backed code challenge; add resend, rate limits, expiry and replay checks before enabling this template.
2. **Password reset:** Inventory the live password recovery route and backend delivery implementation. Use its provider-issued code and preserve recovery safeguards; never substitute a client-generated code.
3. **Dev/Test:** Issue #356 uses AWS Cognito for private gateway access. Confirm the chosen Cognito user-pool MFA and message customization support, including SES verification. Cognito's native email templates may require a different renderer; keep the six-digit design as close as the provider allows.
4. **Email client constraints:** Gmail and Outlook do not execute clipboard JavaScript in email. Display a contiguous selectable code and text/plain alternative. Do not add a nonfunctional Copy button. Any actual clipboard control must live on a trusted authenticated HTTPS page, not a code-bearing URL.
5. **Tests:** Add unit coverage for all four purposes, escaping, invalid inputs, HTML/text consistency and accessibility; provider integration tests for issuance/verification; email rendering checks across major clients. Verify no codes enter logs, analytics or URLs.
6. **Release:** Do not deploy a partial verification flow. Keep this PR draft until security review, full acceptance tests and CI pass. Explicit approval is required for Test/Production and infrastructure changes.
