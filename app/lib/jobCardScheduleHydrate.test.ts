import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  parseJobCardSchedulesApiPayload,
  shouldRetryJobCardScheduleFetch,
} from "./jobCardScheduleHydrate";

const JOB_ID = "a29d99f4-89ae-4d2c-97d1-6d2cb3db1cf1";
const COMPANY_ID = "ea54a171-b43e-44c7-8186-fa75d4ff8b42";
const SCHEDULE_ID = "11111111-1111-4111-8111-111111111111";

const scheduleRow = {
  id: SCHEDULE_ID,
  company_id: COMPANY_ID,
  job_id: JOB_ID,
  kind: "work",
  status: "scheduled",
  timezone: "America/Chicago",
  all_day: true,
  starts_on: "2026-08-25",
  ends_on: "2026-08-26",
  start_local_time: null,
  end_local_time: null,
  range_start_at: "2026-08-25T05:00:00.000Z",
  range_end_at: "2026-08-27T05:00:00.000Z",
  notes: null,
  created_by_user_id: null,
  updated_by_user_id: null,
  created_at: "2026-08-17T00:00:00.000Z",
  updated_at: "2026-08-17T00:00:00.000Z",
  cancelled_at: null,
  row_version: 1,
};

describe("jobCardScheduleHydrate", () => {
  test("parses canonical schedule list from API payload", () => {
    const rows = parseJobCardSchedulesApiPayload({
      ok: true,
      schedules: [scheduleRow],
    });
    assert.ok(rows);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.job_id, JOB_ID);
    assert.equal(rows[0]?.status, "scheduled");
  });

  test("returns null for failed payloads", () => {
    assert.equal(parseJobCardSchedulesApiPayload({ ok: false }), null);
    assert.equal(parseJobCardSchedulesApiPayload(null), null);
  });

  test("retries unauthorized schedule reads up to max attempts", () => {
    assert.equal(
      shouldRetryJobCardScheduleFetch(false, { code: "unauthorized" }, 0),
      true
    );
    assert.equal(
      shouldRetryJobCardScheduleFetch(true, { code: "unauthorized" }, 0),
      true
    );
    assert.equal(
      shouldRetryJobCardScheduleFetch(true, { ok: true, schedules: [] }, 0),
      false
    );
    assert.equal(
      shouldRetryJobCardScheduleFetch(false, { code: "unauthorized" }, 5),
      false
    );
  });
});
