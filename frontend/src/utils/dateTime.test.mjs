import assert from "node:assert/strict";
import test from "node:test";
import { formatLocalDateTime, parseUtcInstant } from "./dateTime.ts";

test("accepts UTC and explicit offsets as absolute instants", () => {
  assert.equal(parseUtcInstant("2026-03-08T06:30:00Z")?.toISOString(), "2026-03-08T06:30:00.000Z");
  assert.equal(parseUtcInstant("2026-03-08T01:30:00-05:00")?.toISOString(), "2026-03-08T06:30:00.000Z");
});

test("rejects naive and invalid timestamps", () => {
  assert.equal(parseUtcInstant("2026-03-08T01:30:00"), null);
  assert.equal(parseUtcInstant("not-a-date"), null);
  assert.equal(formatLocalDateTime("2026-03-08T01:30:00"), "—");
});

test("formats the same instant across the DST boundary in selected zones", () => {
  const before = formatLocalDateTime("2026-03-08T06:30:00Z", "en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
  const after = formatLocalDateTime("2026-03-08T07:30:00Z", "en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
  const london = formatLocalDateTime("2026-03-08T07:30:00Z", "en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "short",
  });

  assert.match(before, /1:30\s*AM EST/);
  assert.match(after, /3:30\s*AM EDT/);
  assert.match(london, /07:30 GMT/);
});
