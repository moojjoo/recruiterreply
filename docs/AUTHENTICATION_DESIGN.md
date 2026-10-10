# Social OAuth Login Implementation

## Goal
Add login with Google, GitHub, LinkedIn, and Facebook to the existing authentication flow.

## Current state
- The app currently supports email/password registration and login in [backend/Controllers/AuthController.cs](backend/Controllers/AuthController.cs)
- The user entity exists in [backend/Entities/UserEntity.cs](backend/Entities/UserEntity.cs)
- The login UI is in [frontend/src/components/auth/LoginForm.tsx](frontend/src/components/auth/LoginForm.tsx)

## Requirements
- Add OAuth login buttons for Google
- Configure OAuth callback routes on the backend
- Validate provider-specific user claims and map them to the existing app user model
- Support both new user creation and linking to existing user accounts
- Preserve the existing JWT token behavior and authenticated API access
- Keep the login UX consistent with the current frontend design

## Technical constraints
- Use ASP.NET Core authentication packages for OAuth
- Keep secrets in environment variables or secure config, not hardcoded
- Do not break the existing email/password auth flow
- Use the existing JWT-based user session pattern

## Google OAuth configuration by environment

The backend requires `Google:ClientId`, `Google:ClientSecret`, and
`Google:RedirectUri`; the callback also requires `Frontend:BaseUrl`. Redirect and
frontend URLs must be absolute HTTP(S) URLs. Missing or invalid URLs are rejected rather
than silently falling back to localhost.

Deployed backends load AWS Secrets Manager after environment variables, so keys present
in a secret override the corresponding values in `infra/aws/docker-compose.multi-env.yml`.
Set the following values in each environment's `backend-app-secrets` secret and keep
them aligned with the Compose values:

| Environment | `Google:RedirectUri` | `Frontend:BaseUrl` |
| --- | --- | --- |
| Dev | `https://api-dev.recruiterreply.com/api/auth/google/callback` | `https://dev.recruiterreply.com` |
| Test | `https://api-test.recruiterreply.com/api/auth/google/callback` | `https://test.recruiterreply.com` |
| Prod | `https://api.recruiterreply.com/api/auth/google/callback` | `https://recruiterreply.com` |

In Google Cloud Console, register all three exact callback URLs under the OAuth web
client used by each environment's `Google:ClientId`. Register the corresponding
frontend origins (`https://dev.recruiterreply.com`,
`https://test.recruiterreply.com`, and `https://recruiterreply.com`) as authorized
JavaScript origins. The frontend build selects its environment's API base URL
separately; using the same frontend build does not set the backend OAuth callback or
frontend return URL.

Before enabling sign-in, verify the secret values without printing or sharing the client
secret, and request `GET /api/auth/google/start` on each API host. Its `redirect_uri`
must exactly match that environment's callback above. Complete a browser sign-in on each
environment to verify the callback and return URL end to end.

## Files likely to change
- [backend/Controllers/AuthController.cs](backend/Controllers/AuthController.cs)
- [backend/Entities/UserEntity.cs](backend/Entities/UserEntity.cs)
- [backend/Program.cs](backend/Program.cs)
- [frontend/src/components/auth/LoginForm.tsx](frontend/src/components/auth/LoginForm.tsx)
- [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx)
- [frontend/src/services/api/authService.ts](frontend/src/services/api/authService.ts)

## Acceptance criteria
- Users can sign in using all four providers
- New social users are created correctly
- Existing users can link or sign in with the same email
- Authenticated requests still use JWT tokens
- Redirect URIs and provider config are documented
- Login page shows provider buttons and works without breaking current email/password flow

## Validation
- Run backend build and API checks
- Verify callback flows with sample provider config
- Confirm login success and token issuance
- Check unauthorized and duplicate-account behavior