# Issue 456 operations gates

This runbook records the operator evidence required before enabling the Cognito
BFF in Dev or Test. It intentionally does not contain secret values.

## AWS configuration contract

Each environment's existing secret remains the authoritative runtime source:

| Environment | Secret name |
| --- | --- |
| Dev | `recruiterreply/dev/backend-app-secrets` |
| Test | `recruiterreply/test/backend-app-secrets` |
| Prod | `recruiterreply/prod/backend-app-secrets` |

Add these JSON keys to the target secret during the approved rollout, then
verify the deployed container receives the flattened configuration:

```json
{
  "Aws:SecretsManager:SecretName": "recruiterreply/<environment>/backend-app-secrets",
  "CognitoBff:Enabled": true,
  "CognitoBff:CsrfEnabled": true,
  "CognitoBff:Issuer": "https://cognito-idp.<region>.amazonaws.com/<user-pool-id>",
  "CognitoBff:ResourceIdentifier": "https://api.<environment>.recruiterreply.com",
  "CognitoBff:ClientId": "<machine-client-id>",
  "CognitoBff:ClientSecret": "<machine-client-secret>",
  "CognitoBff:Domain": "<cognito-domain>",
  "CognitoBff:RedirectUri": "https://<environment>.recruiterreply.com/api/auth/cognito/callback",
  "CognitoBff:PostLogoutRedirectUri": "https://<environment>.recruiterreply.com/login",
  "CognitoBff:SessionTableName": "recruiterreply-<environment>-bff-sessions",
  "CognitoBff:SessionKmsKeyId": "<key-id-or-arn>",
  "LegacyAuth:Enabled": false
}
```

The same environment secret must also hold the separately rotated machine
credentials, using the exact resource identifier above:

```json
{
  "CognitoBff:MachineClients:Ci:ClientId": "<ci-client-id>",
  "CognitoBff:MachineClients:Ci:ClientSecret": "<ci-client-secret>",
  "CognitoBff:MachineClients:Worker:ClientId": "<worker-client-id>",
  "CognitoBff:MachineClients:Worker:ClientSecret": "<worker-client-secret>",
  "CognitoBff:MachineClients:Ops:ClientId": "<ops-client-id>",
  "CognitoBff:MachineClients:Ops:ClientSecret": "<ops-client-secret>"
}
```

Terraform creates these clients only when `enable_cognito_bff = true` and all
environment-specific pool IDs, resource identifiers, callback URLs, and logout
URLs are supplied. Its sensitive outputs must be transferred to Secrets
Manager through a separately reviewed secret operation; this repository does
not manage secret values in Terraform.

The EC2 role receives only `GetItem`, `PutItem`, `DeleteItem` for the exact
session table, `GenerateDataKey`/`Decrypt` for the exact KMS key, and
`GetSecretValue`/`DescribeSecret` for the exact environment secret when the
optional Dev Terraform ARNs are supplied.

## Backup and restore evidence

Before applying the organization migration, capture a successful backup and a
non-production restore check. The existing host runbook is:

```bash
sudo /usr/local/libexec/recruiterreply/test_postgres_backup_restore.sh dev
sudo /usr/local/libexec/recruiterreply/test_postgres_backup_restore.sh test
systemctl list-timers 'recruiterreply-postgres-*'
```

Attach the following to the issue: backup object key and timestamp, dump
validation output, restore-test exit status, restored schema/table count, and
the migration SQL review. Never run `Down()` on a persistent environment.

## Live validation gate

After the secrets and Cognito app clients are installed, validate each target:

1. Login redirects to Cognito with PKCE and the requested API resource/scopes.
2. Callback creates only `__Host-rr_session`; no access or refresh token is in
   the URL, browser storage, or response body.
3. A same-origin mutation with a valid `X-CSRF-TOKEN` succeeds.
4. Missing, mismatched, cross-origin, and replayed CSRF requests fail.
5. Expired/revoked sessions fail; logout removes the cookie and server record.
6. A user cannot read or mutate another tenant's resource.
7. `/api/auth/login`, `/api/auth/register`, and Google JWT callback return 410
   after `LegacyAuth:Enabled=false`.

Record the Dev and Test URLs, UTC timestamps, HTTP status codes, and deployment
image SHA in the issue. Test/Prod promotion remains a separate owner command.
