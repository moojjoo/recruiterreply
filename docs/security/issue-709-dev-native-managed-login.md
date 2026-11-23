# Dev native application managed login

This source is dark by default. No checked-in Terraform variable enables the
custom domain, branding, DNS alias or application routing.

The reviewed candidate is `app-auth-dev.recruiterreply.com` on the existing Dev
user pool, using a separately reviewed `us-east-1` certificate supplied through
deployment configuration. Terraform validation rejects other environments,
hostnames and certificate regions without committing account-specific metadata.

Activation requires two ordered, separately reviewed actions:

1. Set the Dev-only Terraform maps and BFF branding environment, review a saved
   plan, apply it, and verify the custom domain is ACTIVE and describes the exact
   Dev pool. The existing Cognito prefix domain must not be replaced or changed.
2. Set `CognitoBff:NativeEndpointEnabled=true`, the exact `NativeDomain`, and the
   independently read-back `NativeDomainVerifiedUserPoolId` in Dev application
   configuration, then deploy through the normal Dev gate.

Only an unlinked native login selects the custom endpoint. Google and all linking
transactions retain the existing prefix endpoint. The protected OAuth transaction
binds the exact endpoint and pool, and callback configuration is revalidated before
the client secret is added to the exchange request or an HTTP client is created.

Rollback starts by disabling `NativeEndpointEnabled` and redeploying the Dev app.
After the native route is verified back on the prefix, remove DNS, branding and the
custom domain through a separately reviewed Terraform plan. Never delete or replace
the existing prefix domain as part of rollback.
