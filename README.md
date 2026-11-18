# RecruiterReply

RecruiterReply helps job seekers understand recruiter outreach, write thoughtful responses, compare opportunities, and manage the follow-up work around a job search.

## What it does

- Analyze recruiter messages for compensation, red flags, questions to ask, and opportunity signals.
- Generate replies for interested, follow-up, compensation, counteroffer, and decline scenarios.
- Compare job offers with compensation, benefits, commute, work arrangement, risk, and recommendations.
- Track messages and opportunities, maintain a career profile, and use the recruiter inbox workflow.
- Connect Gmail for recruiter-message synchronization, labels, and suggested drafts.
- Support email/password and Google authentication, password recovery, usage tracking, and Stripe billing.

## Technology

- Frontend: React 19, TypeScript, React Router 7, Vite 8, Tailwind CSS 4, and Axios.
- Backend: ASP.NET Core 10 REST API with Entity Framework Core and PostgreSQL.
- AI: OpenAI API calls are made by the backend; browser code does not contain an API key.
- Infrastructure: Terraform, Docker Compose, nginx, EC2, ECR, S3, CloudFront, and GitHub Actions with AWS OIDC.

The source-aligned architecture inventory is in [docs/CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md).

## Repository layout

~~~text
backend/                 ASP.NET Core API, services, repositories, entities, and migrations
frontend/                React application, routes, components, and API clients
infra/aws/               Terraform and multi-environment Docker/nginx configuration
docs/                    Architecture, security, release, database, and feature documentation
.github/workflows/       Verification, build, CodeQL, Playwright, and promotion workflows
~~~

Important source locations include backend/Controllers/ for HTTP endpoints, backend/Services/ for business logic and OpenAI integration, backend/Data/RecruiterReplyDbContext.cs for EF Core mappings, backend/Migrations/ for database migrations, frontend/src/App.tsx for routes, and frontend/src/components/ plus frontend/src/pages/ for UI features.

## Engineering operating model

### Parallel delivery

Parallel agents may work on independent, approved issues. Each issue uses its own branch and isolated Git worktree; agents do not share a feature branch or modify another agent's worktree. Changes converge through focused pull requests, review, and required checks before they can reach `main`. See [the development workflow](docs/DEVELOPMENT_WORKFLOW.md) for issue metadata, branch naming, PR titles, execution authorization, and reconciliation rules.

### Authorization and release evidence

Repository automation does not grant itself authority to merge or deploy. Owner authorization, current-head checks, branch protection, environment approvals, and the protected execution workflow remain authoritative. A label, PR body, agent instruction, or successful verification run is not a substitute for the required owner-authenticated command or GitHub protection rules.

Feature-branch and pull-request runs verify changes but do not release them. Dev and Test releases originate from verified commits on `main` through the existing workflows. A release is not treated as deployed merely because CI or a build passed: the environment deployment, immutable release identity, and required smoke or boundary verification must succeed for the same SHA. Production remains a separate, explicit promotion with its own approval gates. See [release promotion controls](docs/RELEASE_PROMOTION.md) and the [workflow inventory](docs/GITHUB_ACTIONS_WORKFLOW_INVENTORY.md).

### Environment topology

Dedicated physical Dev/Production isolation is a planned target, not a completed repository claim. The current [shared-host operations runbook](docs/SHARED_EC2_OPERATIONS_RUNBOOK.md) documents one-host safety controls and split criteria. The checked-in multi-environment Compose file defines separate Dev, Test, and Production application/database names while referencing one PostgreSQL service and placeholder superuser settings. That configuration is repository evidence only; it does not by itself verify the live topology or credentials.

## Local development (Ubuntu/WSL)

Run repository commands in Ubuntu WSL. Prerequisites are .NET 10 SDK, Node.js 24+, npm 11.17+, and PostgreSQL or the repository's local database configuration.

Use ignored local .env/.env.local files or .NET user-secrets. Never commit credentials, .env files, connection strings, or private keys. A real OpenAI key belongs only in local user-secrets or an ignored environment file:

~~~bash
cd backend
dotnet user-secrets init
dotnet user-secrets set "OpenAI:ApiKey" "<your-local-key>"
~~~

For deployed environments, AWS Secrets Manager is authoritative. See [docs/CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md) for secret loading and [docs/AUTHENTICATION_DESIGN.md](docs/AUTHENTICATION_DESIGN.md) for authentication configuration.

### Start the backend

~~~bash
cd backend
dotnet restore
dotnet run
~~~

The development launch profile targets http://localhost:5002 and https://localhost:5003. API documentation is an explicit opt-in: set `Swagger:Enabled=true`, authenticate as an application user, and use `/api/swagger`. The default `/swagger` and `/openapi` aliases remain unavailable.

### Start the frontend

~~~bash
cd frontend
npm ci
npm run dev
~~~

The Vite server runs at http://localhost:5173 and proxies /api to http://localhost:5002.

Useful frontend commands:

~~~bash
npm run lint
npm run build
npm run test:seo
~~~

From the repository root, Playwright tests run with:

~~~bash
npm ci
npx playwright test
~~~

## API overview

When explicitly enabled in Development or Staging, the authenticated read-only API reference is served at `/api/swagger`. Production never serves it. Main API areas are:

| Area | Routes |
| --- | --- |
| Authentication | /api/auth and /api/auth/password-recovery |
| Recruiter messages and analysis | /api/messages, /api/analyze-recruiter-message |
| Reply generation | /api/generate-reply |
| Offer comparison | /api/compare-offers |
| Opportunities | /api/opportunities |
| Career profile | /api/career-profile |
| Gmail | /api/gmail |
| Recruiter inbox | /api/recruiter-inbox |
| Billing and usage | /api/billing |
| Users | /api/users |

Protected routes require the application's authentication flow. Do not paste production credentials or customer data into local diagnostics.

## Verification and release flow

The repository builds once and promotes the same verified commit artifacts between environments:

1. Pull requests and feature-branch pushes run verification checks only; they cannot deploy an environment.
2. A merge to `main` runs [Build and Deploy to Dev](.github/workflows/build.yml), which verifies, builds the backend image and frontend artifact, and deploys that exact SHA to Dev when enabled. Dev is complete only after the deployment and its required verification succeed.
3. [Promote to Test](.github/workflows/promote-test.yml) is manually dispatched from `main`, resolves the latest successful Dev SHA, and promotes its existing artifacts without rebuilding. Test requires separate authorization and deployment verification.
4. [Promote to Prod](.github/workflows/promote-prod.yml) is a separate manual workflow that resolves the latest successful Test SHA and promotes its existing artifacts without rebuilding. Production requires separate explicit authorization and environment approval.

A successful verification or build is not proof of deployment. GitHub deployment status and the workflow's release manifest, release-identity checks, and required smoke/boundary evidence establish whether a specific SHA reached an environment.

Environment URLs:

- Dev: https://dev.recruiterreply.com
- Test: https://test.recruiterreply.com
- Production: https://recruiterreply.com

Read [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md), [docs/RELEASE_PROMOTION.md](docs/RELEASE_PROMOTION.md), and [docs/SHARED_EC2_OPERATIONS_RUNBOOK.md](docs/SHARED_EC2_OPERATIONS_RUNBOOK.md) before changing or promoting a release. Test and Production always require separate explicit authorization.

## Data and security guidance

- Preserve existing user and business data; review migrations under [docs/DATABASE_MIGRATION_POLICY.md](docs/DATABASE_MIGRATION_POLICY.md).
- Use [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) for the current data model.
- Keep secrets out of the frontend and source control.
- Use local user-secrets or ignored environment files for development.
- Use AWS Secrets Manager and environment-scoped configuration for deployed services.
- Do not change working GitHub Actions, Terraform, or deployment settings without an approved issue and review.

## More documentation

- [Current architecture](docs/CURRENT_ARCHITECTURE.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Authentication design](docs/AUTHENTICATION_DESIGN.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Database migration policy](docs/DATABASE_MIGRATION_POLICY.md)
- [Frontend architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Backend architecture](docs/BACKEND_ARCHITECTURE.md)
- [Dependabot manual-review policy](docs/DEPENDABOT_AUTOMERGE.md)
