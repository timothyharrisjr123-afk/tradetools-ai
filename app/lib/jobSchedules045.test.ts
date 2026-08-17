/**
 * R3F — job_schedules 045 contracts, mapper, Activity presentation.
 *
 * Run:
 * npx tsx --test app/lib/jobSchedules045.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { composeJobActivityItems } from "./jobActivityComposer";
import { isAllowedStageEdge } from "./jobLifecycleMapper";
import {
  JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED,
  JOB_ACTIVITY_EVENT_TYPES,
} from "./jobLifecycleTypes";
import { TRANSITION_JOB_STAGE_RPC_V1 } from "./jobLifecyclePersistence";
import {
  buildScheduleTimezoneSettingsHref,
  calendarCivilRangeUtc,
  civilDateStartUtcIso,
  formatScheduleWindowLabel,
  parseScheduleResumeContext,
  parseTimezoneReturnPath,
  parseJobScheduleRow,
  stripScheduleResumeParams,
  validateScheduleWriteInput,
} from "./jobScheduleMapper";
import {
  SCHEDULE_JOB_RPC_V1,
  RESCHEDULE_JOB_RPC_V1,
  UNSCHEDULE_JOB_RPC_V1,
} from "./jobScheduleTypes";
import { getDefaultVisibleColumnKeys } from "../tools/roofing/saved/jobsBoardUtils";

const ROOT = process.cwd();
const SQL_045 = readFileSync(
  join(ROOT, "supabase/migrations/20260817_045_job_schedules.sql"),
  "utf8"
);
const SQL_038 = readFileSync(
  join(ROOT, "supabase/migrations/20260816_038_job_lifecycle_foundation.sql"),
  "utf8"
);
const SAVED_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/saved/SavedClient.tsx"),
  "utf8"
);
const CALENDAR_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/calendar/FieldDiveCalendarClient.tsx"),
  "utf8"
);
const TIMEZONE_SETTINGS = readFileSync(
  join(ROOT, "app/tools/settings/SettingsCompanyTimezoneSection.tsx"),
  "utf8"
);

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("045 schema contracts", () => {
  test("adds companies.timezone without Chicago backfill", () => {
    assert.match(SQL_045, /alter table public\.companies/);
    assert.match(SQL_045, /add column if not exists timezone text null/);
    assert.doesNotMatch(SQL_045, /set timezone = 'America\/Chicago'/);
    assert.doesNotMatch(SQL_045, /add column.*scheduled_at/);
    assert.doesNotMatch(SQL_045, /create table[\s\S]*calendar_events/);
  });

  test("job_schedules is the canonical owner", () => {
    assert.match(SQL_045, /create table if not exists public\.job_schedules/);
    assert.match(SQL_045, /kind text not null default 'work'/);
    assert.match(SQL_045, /status in \('scheduled', 'cancelled'\)/);
    assert.match(SQL_045, /starts_on date not null/);
    assert.match(SQL_045, /ends_on date not null/);
    assert.match(SQL_045, /range_start_at timestamptz not null/);
    assert.match(SQL_045, /range_end_at timestamptz not null/);
    assert.match(SQL_045, /row_version integer not null default 1/);
    assert.doesNotMatch(SQL_045, /crew_name/);
    assert.doesNotMatch(SQL_045, /google/);
    assert.doesNotMatch(SQL_045, /assigned_user_ids/);
  });

  test("one active work schedule per job and cancelled rows are immutable", () => {
    assert.match(SQL_045, /job_schedules_one_active_work/);
    assert.match(
      SQL_045,
      /where kind = 'work' and status = 'scheduled'/
    );
    assert.match(SQL_045, /cancelled job_schedules rows are immutable and must not be revived/);
    assert.match(SQL_045, /if tg_op = 'UPDATE' and old\.status = 'cancelled'/);
    const scheduleFn = SQL_045.slice(
      SQL_045.indexOf("create or replace function public.schedule_job_v1")
    );
    const scheduleBody = scheduleFn.slice(
      0,
      scheduleFn.indexOf("create or replace function public.reschedule_job_v1")
    );
    assert.match(scheduleBody, /insert into public\.job_schedules/);
    assert.doesNotMatch(scheduleBody, /update public\.job_schedules/);
  });

  test("all-day exclusive range_end_at is start of day after ends_on", () => {
    assert.match(
      SQL_045,
      /range_end_at := \(\(p_ends_on \+ 1\)::timestamp at time zone p_timezone\)/
    );
    assert.match(
      SQL_045,
      /range_start_at := \(p_starts_on::timestamp at time zone p_timezone\)/
    );
  });

  test("RPCs and generic transition remain separate", () => {
    assert.equal(SCHEDULE_JOB_RPC_V1, "schedule_job_v1");
    assert.equal(RESCHEDULE_JOB_RPC_V1, "reschedule_job_v1");
    assert.equal(UNSCHEDULE_JOB_RPC_V1, "unschedule_job_v1");
    assert.match(SQL_045, /create or replace function public\.schedule_job_v1/);
    assert.match(SQL_045, /company_timezone_required/);
    assert.match(SQL_045, /schedule_stale/);
    assert.match(SQL_045, /unschedule_blocked_production/);
    assert.match(SQL_045, /unschedule_blocked_complete/);
    assert.match(SQL_045, /disposition_blocks_schedule/);
    assert.doesNotMatch(SQL_045, /create or replace function public\.transition_job_stage_v1/);
    assert.match(SQL_038, /scheduled_blocked_until_r3f/);
    assert.equal(JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED, false);
    assert.equal(isAllowedStageEdge("approved", "scheduled"), false);
    assert.equal(TRANSITION_JOB_STAGE_RPC_V1, "transition_job_stage_v1");
  });

  test("Approved→Scheduled and reverse use lifecycle GUC writers", () => {
    assert.match(SQL_045, /job_lifecycle_apply_scheduled_from_work_v1/);
    assert.match(SQL_045, /job_lifecycle_apply_approved_from_unschedule_v1/);
    assert.match(SQL_045, /set_config\('job_lifecycle\.allow_stage_write', '1', true\)/);
    assert.match(SQL_045, /stage = 'scheduled'/);
    assert.match(SQL_045, /reason', coalesce\(nullif\(p_reason, ''\), 'scheduled_job'\)/);
    assert.match(SQL_045, /reason', 'unscheduled_job'/);
  });

  test("reschedule mutates the same row without stage_changed", () => {
    const reschedule = SQL_045.slice(
      SQL_045.indexOf("create or replace function public.reschedule_job_v1")
    );
    const body = reschedule.slice(
      0,
      reschedule.indexOf("create or replace function public.unschedule_job_v1")
    );
    assert.match(body, /row_version = v_active\.row_version \+ 1/);
    assert.match(body, /job_rescheduled/);
    assert.doesNotMatch(body, /job_lifecycle_apply_scheduled_from_work_v1/);
    assert.doesNotMatch(body, /stage_entered_at = v_now/);
  });

  test("RLS select-only for authenticated", () => {
    assert.match(SQL_045, /alter table public\.job_schedules enable row level security/);
    assert.match(SQL_045, /grant select on table public\.job_schedules to authenticated/);
    assert.match(SQL_045, /revoke all on table public\.job_schedules from authenticated/);
    assert.doesNotMatch(SQL_045, /on public\.job_schedules\s+for insert/i);
    assert.match(
      SQL_045,
      /grant execute on function public\.schedule_job_v1\(jsonb\) to authenticated/
    );
    assert.doesNotMatch(
      SQL_045,
      /grant execute on function public\.schedule_job_v1\(jsonb\) to anon/
    );
    assert.ok(
      SQL_045.indexOf("create or replace function public.job_schedule_row_json") <
        SQL_045.indexOf(
          "revoke all on function public.job_schedule_row_json"
        )
    );
    assert.match(
      SQL_045,
      /revoke all on function public\.job_schedule_window_json[\s\S]*from authenticated/
    );
  });

  test("activity types include schedule facts", () => {
    assert.deepEqual(
      [...JOB_ACTIVITY_EVENT_TYPES],
      [
        "job_created",
        "stage_changed",
        "disposition_changed",
        "job_scheduled",
        "job_rescheduled",
        "job_unscheduled",
      ]
    );
    assert.match(SQL_045, /'job_scheduled',\s*'job_rescheduled',\s*'job_unscheduled'/);
  });
});

describe("schedule mapper", () => {
  test("all-day and timed labels", () => {
    assert.equal(
      formatScheduleWindowLabel({
        all_day: true,
        starts_on: "2026-08-25",
        ends_on: "2026-08-25",
        start_local_time: null,
        end_local_time: null,
      }),
      "Aug 25 · All day"
    );
    assert.equal(
      formatScheduleWindowLabel({
        all_day: true,
        starts_on: "2026-08-25",
        ends_on: "2026-08-26",
        start_local_time: null,
        end_local_time: null,
      }),
      "Aug 25–26 · All day"
    );
    assert.equal(
      formatScheduleWindowLabel({
        all_day: false,
        starts_on: "2026-08-25",
        ends_on: "2026-08-25",
        start_local_time: "08:00:00",
        end_local_time: "16:00:00",
      }),
      "Aug 25 · 8:00 AM–4:00 PM"
    );
  });

  test("rejects invalid timed same-day windows", () => {
    assert.equal(
      validateScheduleWriteInput({
        jobId: JOB_ID,
        startsOn: "2026-08-25",
        endsOn: "2026-08-25",
        allDay: false,
        startLocalTime: "16:00",
        endLocalTime: "08:00",
      }),
      "invalid_window"
    );
    assert.equal(
      validateScheduleWriteInput({
        jobId: JOB_ID,
        startsOn: "2026-08-25",
        endsOn: "2026-08-26",
        allDay: true,
      }),
      null
    );
  });

  test("converts Calendar civil bounds in company timezone", () => {
    assert.equal(
      civilDateStartUtcIso("2026-08-25", "America/Chicago"),
      "2026-08-25T05:00:00.000Z"
    );
    assert.equal(
      civilDateStartUtcIso("2026-08-25", "America/New_York"),
      "2026-08-25T04:00:00.000Z"
    );
    assert.equal(
      civilDateStartUtcIso("2026-08-25", "America/Denver"),
      "2026-08-25T06:00:00.000Z"
    );
  });

  test("uses DST-aware exclusive Calendar range boundaries", () => {
    assert.deepEqual(
      calendarCivilRangeUtc({
        firstVisibleOn: "2026-03-08",
        afterLastVisibleOn: "2026-03-09",
        timezone: "America/Chicago",
      }),
      {
        from: "2026-03-08T06:00:00.000Z",
        to: "2026-03-09T05:00:00.000Z",
      }
    );
  });

  test("round-trips safe timezone scheduling resume context", () => {
    const href = buildScheduleTimezoneSettingsHref(
      `/tools/roofing?entry=job-card&job=${JOB_ID}`,
      {
        jobId: JOB_ID,
        startsOn: "2026-08-25",
        endsOn: "2026-08-26",
      }
    );
    const settingsUrl = new URL(href, "https://fielddive.local");
    const returnTo = parseTimezoneReturnPath(settingsUrl.search);
    assert.ok(returnTo);
    assert.deepEqual(
      parseScheduleResumeContext(new URL(returnTo, "https://fielddive.local").search),
      {
        jobId: JOB_ID,
        startsOn: "2026-08-25",
        endsOn: "2026-08-26",
      }
    );
    assert.equal(
      stripScheduleResumeParams(returnTo),
      `/tools/roofing?entry=job-card&job=${JOB_ID}`
    );
    assert.equal(
      parseTimezoneReturnPath("?timezoneReturnTo=https%3A%2F%2Fevil.example"),
      null
    );
  });

  test("parses schedule rows", () => {
    const row = parseJobScheduleRow({
      id: JOB_ID,
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
      notes: "Gate code 1234",
      created_by_user_id: null,
      updated_by_user_id: null,
      created_at: "2026-08-17T00:00:00.000Z",
      updated_at: "2026-08-17T00:00:00.000Z",
      cancelled_at: null,
      row_version: 1,
    });
    assert.ok(row);
    assert.equal(row?.timezone, "America/Chicago");
    assert.equal(row?.all_day, true);
  });
});

describe("activity presentation", () => {
  test("shows Job scheduled and suppresses Moved to Scheduled", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        {
          id: "a1",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "job_scheduled",
          occurred_at: "2026-08-17T12:00:00.000Z",
          payload_json: {
            window: {
              all_day: true,
              starts_on: "2026-08-25",
              ends_on: "2026-08-25",
              timezone: "America/Chicago",
            },
          },
        },
        {
          id: "a2",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "stage_changed",
          occurred_at: "2026-08-17T12:00:00.000Z",
          payload_json: {
            from_stage: "approved",
            to_stage: "scheduled",
            reason: "scheduled_job",
          },
        },
      ],
    });
    assert.equal(items.some((item) => item.label === "Job scheduled"), true);
    assert.equal(items.some((item) => item.label === "Moved to Scheduled"), false);
  });

  test("shows Job unscheduled and suppresses Moved to Approved", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        {
          id: "u1",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "job_unscheduled",
          occurred_at: "2026-08-17T12:05:00.000Z",
          payload_json: {
            previous_window: {
              all_day: true,
              starts_on: "2026-08-25",
              ends_on: "2026-08-25",
              timezone: "America/Chicago",
            },
          },
        },
        {
          id: "u2",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "stage_changed",
          occurred_at: "2026-08-17T12:05:00.000Z",
          payload_json: {
            from_stage: "scheduled",
            to_stage: "approved",
            reason: "unscheduled_job",
          },
        },
      ],
    });
    assert.equal(items.some((item) => item.label === "Job unscheduled"), true);
    assert.equal(items.some((item) => item.label === "Moved to Approved"), false);
  });
});

describe("board", () => {
  test("Scheduled lane is in the working board", () => {
    const visible = getDefaultVisibleColumnKeys();
    assert.equal(visible.includes("scheduled"), true);
    assert.equal(visible.includes("deposit_paid"), false);
  });

  test("has no active legacy local-estimate scheduling writer", () => {
    assert.doesNotMatch(SAVED_CLIENT, /markSavedEstimateScheduled/);
    assert.doesNotMatch(SAVED_CLIENT, /Save Schedule/);
    assert.doesNotMatch(SAVED_CLIENT, /setSchedulingForId/);
    assert.match(
      SAVED_CLIENT,
      /Legacy estimates cannot create a Job schedule/
    );
  });

  test("passes quiet deposit context into the shared Board modal", () => {
    assert.match(SAVED_CLIENT, /r3fDepositDueByJobId/);
    assert.match(
      SAVED_CLIENT,
      /depositNotReceived:\s*r3fDepositDueByJobId\[jobId\] === true/
    );
    assert.match(
      SAVED_CLIENT,
      /depositNotReceived=\{\s*r3fScheduleModal\?\.depositNotReceived === true/
    );
  });
});

describe("Calendar and timezone continuity", () => {
  test("queries visible range using company civil timezone boundaries", () => {
    assert.match(CALENDAR_CLIENT, /calendarCivilRangeUtc/);
    assert.doesNotMatch(CALENDAR_CLIENT, /T00:00:00\.000Z/);
    assert.match(CALENDAR_CLIENT, /firstVisibleOn/);
    assert.match(CALENDAR_CLIENT, /afterLastVisibleOn/);
  });

  test("Settings returns to and resumes the originating schedule flow", () => {
    assert.match(TIMEZONE_SETTINGS, /parseTimezoneReturnPath/);
    assert.match(TIMEZONE_SETTINGS, /router\.push\(returnTo\)/);
    assert.match(CALENDAR_CLIENT, /parseScheduleResumeContext/);
    assert.match(CALENDAR_CLIENT, /timezoneReturnPath="\/tools\/roofing\/calendar"/);
  });
});
