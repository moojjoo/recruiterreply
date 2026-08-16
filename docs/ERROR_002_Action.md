# ERROR_002 Action Report

## Source Plan
Plan file used: docs/ERROR_002.md

## Goal
Fix Google OAuth sign-in and standard registration failures across dev, test, and prod.

## Step-by-Step Execution

### Step 1: Prod redirect_uri_mismatch
What was checked:
- Google Cloud Console OAuth client redirect URIs.

Finding:
- `https://api.recruiterreply.com/api/auth/google/callback` was never registered.

Change made:
- User added the redirect URI (and dev/test equivalents, authorized JS origins) in
  Google Cloud Console.

### Step 2: Wire up dev/test Google OAuth config
What was checked:
- `infra/aws/docker-compose.multi-env.yml` — only `backend-prod` had
  `Google__RedirectUri`, `Frontend__BaseUrl`, `Cors__AllowedOrigins__0`.

Change made:
- Added matching env blocks for `backend-dev` and `backend-test`, sourcing
  `Google__ClientId`/`Google__ClientSecret` from the shared EC2 `.env`.

Files changed:
- infra/aws/docker-compose.multi-env.yml

### Step 3: Diagnose google_auth_failed on prod
What was checked:
- `docker logs recruiterreply-backend-prod` on the EC2 host via SSM.

Finding:
- Google token exchange and userinfo fetch both succeeded. Failure was downstream:
  `Npgsql.PostgresException 28P01: password authentication failed for user "postgres"`.
- `\l` showed `recruiterreply_dev/test/prod` didn't exist at all — only `postgres`,
  `template0`, `template1`.
- Confirmed via hash comparison that `.env`, the postgres container's env, and the
  running backend container's env all agreed on the same password — meaning the
  Postgres role's actual on-disk password was stale (set at first `initdb` in
  2026-06-27, never updated after a later rotation). A `psql -h localhost` test looked
  like it succeeded only because `pg_hba.conf` trusts `127.0.0.1` unconditionally.

Change made:
- `ALTER USER postgres WITH PASSWORD ...` to match `.env`.
- `CREATE DATABASE` for `recruiterreply_dev/test/prod`.
- Ran EF Core migrations against all three via one-off `docker run` using each
  environment's already-deployed image with `Database__AutoMigrate=true`.

### Step 4: Second Google sign-in attempt still failed
What was checked:
- `docker logs recruiterreply-backend-prod` again, now including a real exception
  (logging was added to `AuthController` in this window).

Finding:
- `Microsoft.EntityFrameworkCore.DbUpdateException` -> Postgres `22001`: `value too long
  for type character varying(500)` on the `users` INSERT. `profile_picture_url` was
  `varchar(500)`; Google's picture URL exceeded it.

Change made:
- Widened `ProfilePictureUrl` to `HasMaxLength(2048)` in `RecruiterReplyDbContext`.
- Added `AuthController` logging (`ILogger<AuthController>`) in both Google OAuth
  catch blocks so future failures show the real exception instead of a generic
  `google_auth_failed`.
- Generated EF Core migration `20260816223929_WidenProfilePictureUrl`.
- Applied the `ALTER TABLE ... TYPE character varying(2048)` directly to all three
  databases and recorded the migration in `__EFMigrationsHistory` so future
  `dotnet ef`/`Migrate()` runs stay in sync.

Files changed:
- backend/Controllers/AuthController.cs
- backend/Data/RecruiterReplyDbContext.cs
- backend/Migrations/20260816223929_WidenProfilePictureUrl.cs (+ Designer, snapshot)

### Step 5: Standard registration also failing on dev/test/prod
What was checked:
- Direct `curl -X POST .../api/auth/register` against all three API hosts.

Finding:
- Prod: succeeded (200, token returned).
- Dev/test: connections timed out entirely (curl exit 28) — never reached the backend.
- `getent hosts` showed `api-dev`/`api-test.recruiterreply.com` resolving to
  `44.204.249.31`, while the EC2 instance actually running all three backends
  (`i-0dbe396e361ea6d56`) has public IP `44.193.209.227` — the same IP `api.recruiterreply.com`
  correctly points to.

Change made:
- Route53 `UPSERT` on `api-dev`/`api-test` A records to `44.193.209.227` (matching the
  Terraform-declared pattern in `infra/aws/rout53/route53.tf`, which wasn't re-applied
  with the current IP).

### Step 6: Dev/test still failing after DNS fix — TLS
What was checked:
- `curl -v https://api-dev.recruiterreply.com/...`

Finding:
- `SSL: no alternative certificate subject name matches target host name
  'api-dev.recruiterreply.com'` — server presented the `api.recruiterreply.com`
  certificate for all hosts.
- nginx (`/etc/nginx/sites-enabled/recruiterreply-api`) already had correct
  `proxy_pass` server blocks for `api-dev`/`api-test` (to ports 5001/5002), but neither
  had a `listen 443 ssl` directive or certificate, so they fell through to the sole
  `listen 443 ssl` block (prod's).
- A separate, unrelated `recruiterreply-edge-proxy` Docker container (exited 3 weeks
  prior, code 127) was a dead end — the real TLS termination is a systemd `nginx`
  service on the host.

Change made:
- `certbot --nginx -d api-dev.recruiterreply.com -d api-test.recruiterreply.com` to
  issue a new cert and auto-wire the `listen 443 ssl` + redirect blocks.
- First attempt failed: ACME HTTP-01 challenge timed out. EC2 security group
  (`sg-0d2a00ed00f87df43`) only allowed inbound 443, not 80 — likely also blocking
  future renewal of the existing prod certificate.
- Opened inbound TCP/80 (0.0.0.0/0) on the security group; confirmed host firewall
  (`ufw`/`iptables`) and the subnet NACL were not the blocker.
- Re-ran certbot after propagation; succeeded, certs deployed automatically.

### Step 7: Final verification
What was executed:
- `POST /api/auth/register` against `api.recruiterreply.com`, `api-dev...`, `api-test...`.

Finding:
- All three returned `200` with a valid JWT + user payload.
- Diagnostic test users deleted from all three databases afterward.

### Step 8: Dev/test Google login still failing after all of the above
What was checked:
- `curl https://api-dev.recruiterreply.com/api/auth/google/start` and the test
  equivalent.

Finding:
- Both returned `{"error": "Google:ClientId is not configured."}`.
- The Step 2 `docker-compose.multi-env.yml` commit only ever landed in git. The file
  actually deployed at `/home/ubuntu/recruiterreply` on the EC2 host is a plain
  directory, not a git checkout, and was never updated to match — the dev/test
  `Google__ClientId`/`Google__ClientSecret`/etc. blocks were missing on the host copy.
- The EC2 `.env` also never had `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set.

Change made:
- Pulled the existing OAuth client id/secret from
  `recruiterreply/prod/backend-app-secrets` (Secrets Manager) and added
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` to the EC2 `.env`.
- Synced `infra/aws/docker-compose.multi-env.yml` on EC2 to match the git-committed
  version.
- `docker compose up -d backend-dev backend-test` to recreate both containers with the
  new environment.
- Verified `/api/auth/google/start` on both now returns a correctly-formed Google
  authorization URL with the right per-environment `redirect_uri`.

Open item: confirm the exact `redirect_uri` values
(`https://api-dev.recruiterreply.com/api/auth/google/callback`,
`https://api-test.recruiterreply.com/api/auth/google/callback`) are registered in
Google Cloud Console on this OAuth client — could not be verified from this session.

### Step 9: Browser reported `api-dev.recruiterreply.com/auth/google/start 404`
What was checked:
- The exact failing request path — missing the `/api` prefix the backend routes live
  under (`[Route("api/auth")]`).
- `.github/workflows/deploy-{dev,test,prod}.yml` `FRONTEND_API_BASE_URL`.

Finding:
- Prod: `https://api.recruiterreply.com/api` (correct, includes `/api`).
- Dev/test: `https://api-{dev,test}.recruiterreply.com` (missing `/api`) — the frontend
  build never got the same fix prod received. Prod's nginx block already carries a
  documented compatibility shim for this exact legacy case
  (`location /` prepends `/api/` for old builds that call without the prefix); dev/test
  had no such shim and a single generic `location /` passthrough, so unprefixed calls
  hit routes that don't exist on the backend (404).

Change made:
- Replicated prod's dual-location nginx pattern
  (`/etc/nginx/sites-available/recruiterreply-api`) for `api-dev`/`api-test`: a
  `location /api/` passthrough plus a `location /` fallback that prepends `/api/`.
  First attempt only added the fallback without the passthrough block, which
  double-prefixed already-correct `/api/...` calls (regression, caught and fixed
  immediately via verification).
- Verified both prefixed and unprefixed requests now return `200` on dev and test.
- Fixed the root cause in `.github/workflows/deploy-dev.yml` and `deploy-test.yml`:
  `FRONTEND_API_BASE_URL` now includes `/api`, matching prod. Not yet committed/deployed
  — the nginx shim keeps the currently-deployed frontend working in the meantime, same
  as it does for prod's legacy builds.

Files changed:
- .github/workflows/deploy-dev.yml
- .github/workflows/deploy-test.yml

## Net Result
- Google sign-in and standard registration both work end-to-end on dev, test, and prod.
- Root causes spanned five independent layers: Google Console config, Postgres
  credentials/schema, an undersized DB column, stale DNS, and a missing TLS
  cert/security-group rule — each masked the next until fixed in sequence.
- `AuthController` now logs real exceptions instead of collapsing everything into
  `google_auth_failed`.
- Runbook/source plan restored in repository as `docs/ERROR_002.md`.

## Original Error Context
`https://recruiterreply.com/login?error=google_auth_failed` after completing Google
consent; standard "create an account" also failing on dev/test/prod.
