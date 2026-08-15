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