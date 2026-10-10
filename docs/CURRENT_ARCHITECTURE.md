# RecruiterReply — Current Architecture (source-aligned)

This is a source-code inventory based on the `main` branch reviewed on 2026-10-09. When documentation and implementation disagree, inspect the implementation and update this file. Deployment behavior is governed by the existing workflows; do not change working workflows solely to match documentation.

## Technology and repository layout

- `frontend/`: React 19, TypeScript, Vite 8, React Router 7, Axios, Tailwind CSS 4. Routes/pages include analysis, reply, comparison, opportunities, recruiter inbox, career profile, pricing, authentication callbacks, and account/profile pages.
- `backend/`: ASP.NET Core 10 REST API; controllers, services, repositories, models, entities, middleware, EF Core and PostgreSQL.
- `backend/Data/RecruiterReplyDbContext.cs`: entity mappings for users, messages, analyses, generated replies, opportunities, comparisons, Gmail connections, usage records, career profiles, recruiter threads and recruiter emails.
- `backend/Migrations/`: EF Core migrations for initial schema, Gmail, Google login, billing, recruiter autopilot, and thread drafts.
- `infra/aws/`: Terraform, multi-environment Docker Compose, nginx routing, PostgreSQL initialization.
- `.github/workflows/`: `build.yml`, `promote.yml`, `promote-test.yml`, `promote-prod.yml`, `playwright.yml`, `codeql.yml`. Existing workflows are considered working and must not be edited without a separate approved issue.

## Existing product capabilities

- Recruiter-message analysis, generated replies, offer comparison, opportunities.
- JWT and Google authentication.
- Stripe billing and usage tracking.
- Gmail OAuth, Gmail synchronization and background polling.
- Recruiter triage via `RecruiterPipelineService`, `RecruiterPrefilter`, `CareerRulesEngine`; Gmail labeling and suggested drafts via `RecruiterActionService`.

## Runtime and security

- Deployed dev/test/prod secrets are managed in AWS, according to the project owner. The backend can load AWS Secrets Manager values through `AwsSecretsLoader` when `AWS_SECRETS_MANAGER_SECRET_NAME` or `Aws:SecretsManager:SecretName` is set. Verify the deployed secret names and IAM policies in AWS; repository inspection alone does not verify live configuration.
- Never commit credentials, tokens, connection strings or private keys. Browser `VITE_*` settings are public at runtime and must not contain secrets.
- Local development should use ignored local environment files or .NET user-secrets; local-only `.env` files must not be committed.
- Current local configuration is **not yet HTTPS-only**: `frontend/vite.config.ts` uses port 5173 and proxies to `http://localhost:5002`; `backend/Program.cs` skips HTTPS redirection in Development. Implementing HTTPS-only localhost requires a separately approved source-code change, certificates, proxy/CORS changes and tests.

## Known documentation drift

- Older documents describe React 18 and React Router 6; actual frontend dependencies use React 19 and React Router 7.
- Some older AWS deployment docs reference nonexistent `deploy-dev.yml` / `deploy-prod.yml` workflows or SSH-based image transfer. Use current workflows as authoritative.
- The old backend architecture diagram shows a multi-project `src/` solution; current backend uses folders under `backend/` and `RecruiterReply.csproj`.

See `docs/DEVELOPMENT_WORKFLOW.md` and `docs/DATABASE_MIGRATION_POLICY.md` for the proposed change-management standards.
