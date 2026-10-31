# UTC timestamp contract

RecruiterReply treats timestamps that represent real events as absolute instants.

## Backend and API

- Application code obtains the current instant from `.NET` `TimeProvider`. Security-sensitive expiry paths accept an injected provider so tests can use a deterministic clock.
- Existing entity properties remain `DateTime` for API compatibility in this change. New values are created from `TimeProvider.GetUtcNow().UtcDateTime` and therefore have `DateTimeKind.Utc`.
- API timestamps are ISO 8601 values with an explicit UTC `Z` suffix. Incoming `DateTime` and `DateTimeOffset` values must include either `Z` or an explicit numeric offset; ambiguous values such as `2026-03-08T01:30:00` are rejected with HTTP 400.
- `DateOnly` fields remain calendar dates and are not converted to UTC.
- JSON console logs already use UTC timestamps and request logging already carries the W3C trace/correlation identifier introduced by #453.

## PostgreSQL audit

The EF Core model snapshot maps persisted instant fields to PostgreSQL `timestamp with time zone` (`timestamptz`). Calendar-only `StartDate` fields map to `date`. No `timestamp without time zone` columns are present in the current snapshot, so this change does not generate a migration.

Do not rewrite legacy rows merely because their source offset is unknown. PostgreSQL stores `timestamptz` as an absolute instant, but an older client may have supplied an incorrectly interpreted value before explicit-offset validation existed. Any correction requires:

1. a read-only audit that identifies the source and confidence for each suspect value;
2. a verified backup and restore procedure;
3. a separately approved, additive or otherwise data-preserving migration plan; and
4. explicit handling for ambiguous values instead of assuming a timezone.

## Frontend display

Use `frontend/src/utils/dateTime.ts` for API instants. It rejects naïve timestamps and formats valid instants through `Intl.DateTimeFormat`, which uses the browser's locale and timezone by default and observes daylight-saving transitions. Render timestamps in a semantic `<time dateTime={value}>` element when markup is available.

Do not use `new Date(value).toLocaleString()` directly in a component and do not append or remove `Z` to repair an ambiguous timestamp.
