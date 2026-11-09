# Google sign-in through Cognito

RecruiterReply's active Dev/Test authentication path uses the Cognito BFF. The
frontend must start Google through `/api/auth/cognito/start?provider=Google`;
the legacy `/api/auth/google/*` JWT flow is not the deployed private-environment
login path.

## Cognito configuration

For each environment, create a Google OAuth web application and configure its
callback to the Cognito user-pool domain:

```text
https://<cognito-domain>/oauth2/idpresponse
```

Add Google as a social identity provider on the environment's user pool using
the client ID and secret stored in the approved environment configuration. The
BFF app client must then include both providers:

```hcl
cognito_bff_supported_identity_providers = {
  dev  = ["COGNITO", "Google"]
  test = ["COGNITO", "Google"]
}
```

The provider must exist in the user pool before applying the app-client
provider list. Do not commit Google credentials or place them in frontend
configuration. Keep Production provider setup and enablement separately
approved.

## Application behavior

- `Continue with Google` passes `provider=Google` to the Cognito BFF.
- `Continue with email` opens the normal Cognito hosted sign-in page.
- PKCE, state, nonce, secure cookies, and server-side session creation remain
  unchanged.
- A Google identity whose email already belongs to another account is not
  silently linked; explicit account-linking work is required separately.

## Validation

1. Confirm the target Cognito app client lists `COGNITO` and `Google`.
2. Confirm the Google app callback exactly matches the Cognito
   `oauth2/idpresponse` URL.
3. Start Google from both `/login` and `/register` in Dev.
4. Verify the callback creates only the RecruiterReply session cookie and
   returns to `/dashboard`.
5. Verify email login, logout, invalid state, and same-email account behavior.
