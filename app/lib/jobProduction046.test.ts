/**
 * R3G — migration 046, Start-work, read-model, and surface contracts.
 *
 * Run:
 * npx tsx --test app/lib/jobProduction046.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { composeJobActivityItems } from "./jobActivityComposer";
import {
  buildStartJobWorkPayload,
  parseStartJobWorkResult,
} from "./jobProductionPersistence";
import {
  formatProductionStartedAt,
  START_JOB_WORK_RPC_V1,
} from "./jobProductionTypes";

const ROOT = process.cwd();
const SQL_046 = readFileSync(
  join(ROOT, "supabase/migrations/20260817_046_job_production_start.sql"),
  "utf8"
);
const SQL_038 = readFileSync(
  join(ROOT, "supabase/migrations/20260816_038_job_lifecycle_foundation.sql"),
  "utf8"
);
const JOB_CARD_TABS = readFileSync(
  join(ROOT, "app/tools/roofing/jobCard/JobCardTabs.tsx"),
  "utf8"
);
const JOB_CARD = readFileSync(
  join(ROOT, "app/tools/roofing/jobCard/JobCardScheduleSection.tsx"),
  "utf8"
);
const ROOFING_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/RoofingClient.tsx"),
  "utf8"
);
const SAVED_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/saved/SavedClient.tsx"),
  "utf8"
);
const BOARD_CARD = readFileSync(
  join(ROOT, "app/tools/roofing/saved/components/JobsBoardCard.tsx"),
  "utf8"
);
const CALENDAR = readFileSync(
  join(ROOT, "app/tools/roofing/calendar/FieldDiveCalendarClient.tsx"),
  "utf8"
);

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const SCHEDULE_ID = "22222222-2222-4222-8222-222222222222";
const STARTED_AT = "2026-08-17T13:12:00.000Z";

const schedule = {
  id: SCHEDULE_ID,
  company_id: COMPANY_ID,
  job_id: JOB_ID,
  kind: "work",
  status: "scheduled",
  timezone: "America/Chicago",
  all_day: true,
  starts_on: "2026-08-18",
  ends_on: "2026-08-18",
  start_local_time: null,
  end_local_time: null,
  range_start_at: "2026-08-18T05:00:00.000Z",
  range_end_at: "2026-08-19T05:00:00.000Z",
  notes: null,
  created_by_user_id: null,
  updated_by_user_id: null,
  created_at: "2026-08-16T12:00:00.000Z",
  updated_at: "2026-08-16T12:00:00.000Z",
  cancelled_at: null,
  row_version: 1,
};

describe("046 schema and security contracts", () => {
  test("adds one nullable timestamptz and no production subdomain", () => {
    assert.match(
      SQL_046,
      /add column if not exists production_started_at timestamptz null/
    );
    assert.doesNotMatch(
      SQL_046,
      /create table(?: if not exists)? public\.job_production/i
    );
    assert.doesNotMatch(SQL_046, /production_status|actual_completed_at/i);
    assert.doesNotMatch(SQL_046, /create index/i);
  });

  test("requires actual start exactly in Production or Complete", () => {
    assert.match(SQL_046, /jobs_production_started_at_stage_check/);
    assert.match(
      SQL_046,
      /stage in \('production', 'complete'\)[\s\S]*production_started_at is not null/
    );
    assert.match(
      SQL_046,
      /stage not in \('production', 'complete'\)[\s\S]*production_started_at is null/
    );
    assert.match(SQL_046, /R3G pre-apply integrity failure/);
  });

  test("actual start is raw-write protected and immutable", () => {
    assert.match(SQL_046, /jobs_production_start_guard/);
    assert.match(SQL_046, /production_started_at is immutable/);
    assert.match(
      SQL_046,
      /allow_production_start_write'[\s\S]*start_job_work_v1/
    );
    assert.match(
      SQL_046,
      /revoke update \(production_started_at\)[\s\S]*from authenticated/
    );
  });

  test("RPC is authenticated, company-scoped, and not anonymous", () => {
    assert.match(
      SQL_046,
      /create or replace function public\.start_job_work_v1\(p_payload jsonb\)/
    );
    assert.match(SQL_046, /from public\.company_memberships cm/);
    assert.match(SQL_046, /select j\.\*[\s\S]*for update/);
    assert.match(
      SQL_046,
      /revoke all on function public\.start_job_work_v1\(jsonb\) from anon/
    );
    assert.match(
      SQL_046,
      /grant execute on function public\.start_job_work_v1\(jsonb\) to authenticated/
    );
  });
});

describe("Start-work transaction contracts", () => {
  const rpc = SQL_046.slice(
    SQL_046.indexOf("create or replace function public.start_job_work_v1"),
    SQL_046.indexOf(
      "revoke all on function public.start_job_work_v1",
      SQL_046.indexOf("create or replace function public.start_job_work_v1")
    )
  );

  test("requires exactly one active canonical work schedule", () => {
    assert.match(rpc, /kind = 'work'/);
    assert.match(rpc, /status = 'scheduled'/);
    assert.match(rpc, /if v_active_count <> 1/);
    assert.match(rpc, /start_work_schedule_integrity_error/);
  });

  test("allows calendar variance and preserves schedule truth", () => {
    assert.doesNotMatch(rpc, /current_date|starts_on\s*[<>=]|ends_on\s*[<>=]/);
    assert.doesNotMatch(rpc, /update public\.job_schedules/);
    assert.doesNotMatch(rpc, /row_version\s*=/);
  });

  test("uses one DB time for stage and actual start", () => {
    assert.match(rpc, /v_now timestamptz := transaction_timestamp\(\)/);
    assert.match(rpc, /stage = 'production'/);
    assert.match(rpc, /production_started_at = v_now/);
    assert.match(rpc, /stage_entered_at = v_now/);
  });

  test("writes one visible fact and paired lifecycle truth", () => {
    assert.match(rpc, /'job_work_started'/);
    assert.match(rpc, /'stage_changed'/);
    assert.match(rpc, /'reason', 'work_started'/);
    assert.match(SQL_046, /'job_work_started'[\s\S]*event_type_reserved/);
  });

  test("is idempotent under the same Job lock", () => {
    assert.match(
      rpc,
      /if v_from = 'production'[\s\S]*'idempotent', true/
    );
    const idempotentBranch = rpc.slice(
      rpc.indexOf("if v_from = 'production' then"),
      rpc.indexOf("perform set_config", rpc.indexOf("if v_from = 'production' then"))
    );
    assert.doesNotMatch(idempotentBranch, /job_lifecycle_insert_activity/);
  });

  test("blocks non-active dispositions without payment/signature gates", () => {
    assert.match(rpc, /v_job\.status <> 'active'/);
    assert.match(rpc, /disposition_blocks_start_work/);
    assert.doesNotMatch(
      rpc,
      /job_payment|proposal_signature|proposal_acceptance|deposit_received/
    );
  });

  test("generic transition remains blocked from Production", () => {
    assert.match(SQL_038, /production_blocked_until_start_work/);
    assert.doesNotMatch(
      SQL_046,
      /create or replace function public\.transition_job_stage_v1/
    );
  });
});

describe("R3G TypeScript contracts", () => {
  test("builds the minimal RPC payload", () => {
    assert.equal(START_JOB_WORK_RPC_V1, "start_job_work_v1");
    assert.deepEqual(buildStartJobWorkPayload(COMPANY_ID, JOB_ID), {
      company_id: COMPANY_ID,
      job_id: JOB_ID,
    });
  });

  test("parses canonical Production truth", () => {
    const result = parseStartJobWorkResult({
      ok: true,
      idempotent: false,
      job_id: JOB_ID,
      from_stage: "scheduled",
      to_stage: "production",
      production_started_at: STARTED_AT,
      stage_entered_at: STARTED_AT,
      disposition_unchanged: "active",
      schedule,
      activity_id: "33333333-3333-4333-8333-333333333333",
      stage_activity_id: "44444444-4444-4444-8444-444444444444",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.production_started_at, result.stage_entered_at);
    assert.equal(result.schedule.row_version, 1);
  });

  test("formats the instant in its schedule timezone", () => {
    const value = formatProductionStartedAt(
      STARTED_AT,
      "America/Chicago"
    );
    assert.match(value ?? "", /Aug 17/);
    assert.match(value ?? "", /8:12/);
  });

  test("Activity shows Work started and suppresses paired stage noise", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "job_work_started",
          occurred_at: STARTED_AT,
          payload_json: {
            production_started_at: STARTED_AT,
            planned_window: schedule,
          },
        },
        {
          id: "66666666-6666-4666-8666-666666666666",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "stage_changed",
          occurred_at: STARTED_AT,
          payload_json: {
            from_stage: "scheduled",
            to_stage: "production",
            reason: "work_started",
          },
        },
      ],
    });
    assert.equal(items.filter((item) => item.label === "Work started").length, 1);
    assert.equal(items.some((item) => item.label === "Moved to Production"), false);
  });
});

describe("R3G surface contracts", () => {
  test("Job Card has one-click Start work and read-only Production schedule", () => {
    assert.match(JOB_CARD, /data-jobcard-start-work/);
    assert.match(JOB_CARD, /isProduction \|\| isComplete/);
    assert.match(JOB_CARD, /hasActualStart = isProduction \|\| isComplete/);
    assert.match(JOB_CARD, /Work started/);
    assert.match(JOB_CARD, /Planned schedule ·/);
    assert.doesNotMatch(JOB_CARD, /Production · planned/);
    assert.match(ROOFING_CLIENT, /Planned schedule/);
    assert.doesNotMatch(ROOFING_CLIENT, /Production · planned/);
    assert.match(JOB_CARD, /scheduleReady/);
    assert.doesNotMatch(JOB_CARD, /Undo Start/);
    assert.match(ROOFING_CLIENT, /\/api\/jobs\/start-work/);
    assert.match(ROOFING_CLIENT, /resolveJobCardScheduleDisplay|resolveJobCardActiveSchedule/);
    assert.match(ROOFING_CLIENT, /canonicalJobStage !== "scheduled"/);
    assert.match(JOB_CARD_TABS, /data-jobcard-tabs/);
    assert.match(JOB_CARD_TABS, /overflow-x-auto/);
    assert.match(JOB_CARD_TABS, /min-w-0/);
  });

  test("Board uses the same API and truthful Production language", () => {
    assert.match(SAVED_CLIENT, /\/api\/jobs\/start-work/);
    assert.match(BOARD_CARD, /data-board-start-work/);
    assert.match(BOARD_CARD, /data-board-production-started/);
    assert.doesNotMatch(SAVED_CLIENT, /Crew On Site|On [Ss]ite|Start Job/);
    assert.doesNotMatch(
      SAVED_CLIENT,
      /onStatusChange\?\.\(estimate\.id, "in_progress"\)/
    );
  });

  test("Calendar preserves the event and opens Production in Job Card", () => {
    assert.match(CALENDAR, /data-calendar-event-stage=\{event\.stage\}/);
    assert.match(
      CALENDAR,
      /event\.stage === "production"[\s\S]*router\.push\(buildDbJobCardHref/
    );
    assert.match(CALENDAR, /event\.stage === "complete"/);
    assert.doesNotMatch(CALENDAR, /Start work/);
  });
});

