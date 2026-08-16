# ERROR_002 Troubleshooting Plan

## Objective
Fix Google OAuth sign-in (`redirect_uri_mismatch`, then `google_auth_failed`) and standard
email/password registration failing across dev, test, and prod.

## Steps

1. Register missing Google OAuth redirect URIs in Google Cloud Console for prod.
2. Wire up Google OAuth config (client id/secret, redirect URI, frontend base URL, CORS
   origin) for dev/test backends in `docker-compose.multi-env.yml` — previously only prod had these.
3. Diagnose `google_auth_failed` via prod backend container logs.
4. Diagnose why standard registration also failed on dev/test.
5. Fix each root cause found, verify end-to-end on all three environments.

## Root Causes Found (five, layered)

1. **Google Console**: `https://api.recruiterreply.com/api/auth/google/callback` wasn't a
   registered redirect URI on the OAuth client.
2. **Postgres credentials/schema**: the `postgres` role's password no longer matched
   `.env` (rotated without re-applying to the already-initialized data volume), and
   `recruiterreply_dev/test/prod` databases didn't exist at all — so every DB-touching
   request failed, not just Google sign-in.
3. **`users.profile_picture_url` too narrow**: `varchar(500)` couldn't hold Google's OAuth
   picture URL, so new-user Google sign-in failed at `SaveChangesAsync` with Postgres
   `22001` (value too long), silently caught and reported as `google_auth_failed`.
4. **DNS**: `api-dev`/`api-test.recruiterreply.com` resolved to `44.204.249.31` — a
   different host than the one actually running the backends (`44.193.209.227`, same box
   as prod). Every dev/test request went nowhere.
5. **TLS**: nginx had correct proxy rules for dev/test but no `listen 443 ssl` or
   certificate for those hostnames, so HTTPS silently fell back to prod's certificate
   (SNI mismatch). Blocked by port 80 being closed in the EC2 security group, which also
   would have blocked prod's own cert renewal.

## Required Fixes
- Add prod redirect URI in Google Cloud Console.
- Add per-env Google/Frontend/CORS config to `docker-compose.multi-env.yml` for dev/test.
- Reset Postgres role password, create missing databases, run EF Core migrations.
- Widen `profile_picture_url` to `varchar(2048)` via new EF Core migration.
- Correct Route53 `A` records for `api-dev`/`api-test` to the real EC2 IP.
- Open port 80 in the EC2 security group; issue Let's Encrypt certs for `api-dev`/`api-test`
  via `certbot --nginx`.
- Log the real exception in `AuthController` instead of swallowing it, so future failures
  are diagnosable from `docker logs` directly.
