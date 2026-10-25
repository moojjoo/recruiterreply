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
- Terraform creates a low-cardinality unhandled-exception metric filter and
  alarm per environment. Notifications are attached only when the owner supplies
  an approved SNS topic ARN; no recipient is invented in source control.
- Terraform retention is 7 days for Dev, 14 for Test, and 30 for Production.
  These are cost controls, not billing caps. CloudWatch budgets and alarms must
  use an owner-configured notification destination and are not created with a
  hardcoded recipient.

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
