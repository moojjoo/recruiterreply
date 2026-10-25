# Application observability

RecruiterReply uses one structured logging path for backend and browser diagnostics:

```text
ASP.NET Core ILogger / browser telemetry
  -> newline-delimited JSON on backend stdout
  -> Docker awslogs driver
  -> /recruiterreply/{dev,test,prod}/backend
```

The browser has no application container. Browser events are sent to the bounded
`POST /api/telemetry` endpoint and are recorded in the environment's backend log
group with `source=frontend`. There are intentionally no separate frontend log
groups until an approved routing design is needed.

## Safety and cost controls

- Request paths exclude query strings; request or response bodies are never logged.
- Frontend telemetry accepts only a small allowlist of low-cardinality fields,
  limits payloads to 16 KiB, drops events when its 256-item server buffer is full,
  and allows 20 requests per source IP per minute.
- Browser telemetry is sampled by bounded queueing (20 events) and capped batches;
  reporting failures never affect the user workflow.
- Production should use Warning/Error as the default application log level.
- The deployed Compose definition sets Dev/Test to `Information` and Production
  to `Warning`; Production also suppresses ASP.NET Core and EF Core informational
  framework events.
- Terraform creates a low-cardinality unhandled-exception metric filter and
  alarm per environment. Notifications are attached only when the owner supplies
  an approved SNS topic ARN; no recipient is invented in source control.
- Terraform retention is 7 days for Dev, 14 for Test, and 30 for Production.
  These are cost controls, not billing caps. CloudWatch budgets and alarms must
  use an owner-configured notification destination and are not created with a
  hardcoded recipient.

## Cost assumptions

The initial design uses three standard CloudWatch alarms, three backend log
groups, no CloudWatch Agent, no Container Insights, no tracing collector, and
no separate browser log groups. Using the current us-east-1 CloudWatch pricing
published by AWS (standard log ingestion at approximately $0.50/GB and
standard alarm pricing of approximately $0.10/alarm-month), a conservative
planning case of 0.25 GB ingested per environment per month is approximately
$0.38/month for ingestion plus approximately $0.30/month for alarms, before
any account-level free tier, storage, or query allowance. Actual charges must
be checked against Cost Explorer because log volume and free-tier eligibility
vary by account. See [AWS CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/).

AWS Budgets notifications are free for monitoring-only budgets. The required
$10/month CloudWatch warning budget must use an owner-approved, verified email
or confirmed SNS subscription; no unverified destination is stored in this
repository. AWS documents that SNS budget notifications require an accepted
subscription. See [AWS Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/)
and [AWS budget notification guidance](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html).

## Useful Logs Insights queries

```sql
fields @timestamp, level, EventName, eventName, statusCode, elapsedMs, traceId
| filter eventName in ["HttpRequestCompleted", "UnhandledRequestException"]
| sort @timestamp desc
| limit 100
```

```sql
fields @timestamp, eventName, traceId, metadata
| filter source = "frontend"
| sort @timestamp desc
| limit 100
```

Use `X-Trace-Id` from an API response or the `traceparent` request header to
correlate frontend and backend events. Never paste tokens, cookies, recruiter
content, prompts, payment details, or raw request bodies into log searches.

## Validation and rollback

Run `dotnet test backend/RecruiterReply.Tests/RecruiterReply.Tests.csproj`,
`npm run build` from `frontend`, and `terraform fmt -check` / `terraform validate`
for the Dev root before deployment. Dev smoke validation should send only a
synthetic `FrontendRuntimeError`/backend failure event and verify its arrival;
Test and Production remain behind their existing promotion approvals.

Rollback is a normal application image rollback plus reverting the logging
configuration. The log groups are retained by Terraform (`skip_destroy = true`)
so rollback does not erase diagnostic history.

## Live validation evidence

On 2026-10-25, the deployed SHA `281a859e29ed2ca2737869b34b1e53cdfe799cb3`
was promoted successfully through Dev, Test, and Production. The three
Terraform-managed backend groups existed with 7/14/30-day retention, each had
an `UnhandledRequestException` metric filter and alarm, and each Docker stream
was receiving newline-delimited JSON. Production health traffic produced
`HttpRequestCompleted` events with W3C trace IDs. Test captured a controlled
database connection interruption as an Error event without exposing a client
error payload.

The remaining operator action for full cost acceptance is to configure and
verify the owner-approved $10/month budget notification destination, then
record the confirmation here without recording the address or secret value.
