# Issue #356: Edge token verification building block

This folder contains a **pure RS256 Cognito ID-token verifier** and negative unit tests. It checks signature, unique JWKS key ID, issuer, audience, token use, expiry, issuance, email verification and subject. It intentionally accepts a caller-supplied JWKS and expected environment configuration.

**NOT a deployable CloudFront authentication gate.** No Lambda@Edge function, cookie parser, JWKS fetching/cache, PKCE authorization redirect, callback, nonce/state binding, refresh/revocation, logout, environment isolation or CloudFront association is provided by this PR. A token check by itself does not make Dev/Test private. Never enable Dev/Test based on these tests.

Next implementation must obtain JWKS securely from the correct Cognito issuer, validate tokens on **every** viewer request including cached assets and distribution hostnames, avoid token/cookie leakage, implement complete OAuth code+PKCE flow and secure sessions, and preserve Dev SPA rewriting. Test failure paths and use reviewed Terraform plans. API access isolation is tracked separately under #357. No AWS deployment or live protection is implied.
