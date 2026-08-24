/**
 * R3H — migration 047, Complete job, read-model, and surface contracts.
 *
 * Run:
 * npx tsx --test app/lib/jobComplete047.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { composeJobActivityItems } from "./jobActivityComposer";
import {
  buildCompleteJobWorkPayload,
  parseCompleteJobWorkResult,
} from "./jobCompletePersistence";
import {
  COMPLETE_JOB_WORK_RPC_V1,
  formatJobCompletedAt,
} from "./jobCompleteTypes";
import {
  JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED,
} from "./jobLifecycleTypes";
import { previewStageTransition } from "./jobLifecyclePersistence";
import { isAllowedStageEdge } from "./jobLifecycleMapper";
import { mapDbJobToBoardEstimate } from "./jobBoardAdapter";
import {
  isCleanDbJobCardDeepLink,
  matchingServerJobRecord,
  resolveInitialServerJobSeed,
  shouldSkipClientCanonicalJobHydrate,
} from "./jobCardServerSeed";
import type { JobRecord } from "./jobTypes";

const ROOT = process.cwd();
const SQL_047 = readFileSync(
  join(ROOT, "supabase/migrations/20260823_047_job_work_complete.sql"),
  "utf8"
);
const SQL_038 = readFileSync(
  join(ROOT, "supabase/migrations/20260816_038_job_lifecycle_foundation.sql"),
  "utf8"
);
const SQL_045 = readFileSync(
  join(ROOT, "supabase/migrations/20260817_045_job_schedules.sql"),
  "utf8"
);
const SQL_046 = readFileSync(
  join(ROOT, "supabase/migrations/20260817_046_job_production_start.sql"),
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
const API_ROUTE = readFileSync(
  join(ROOT, "app/api/jobs/complete-work/route.ts"),
  "utf8"
);

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const SCHEDULE_ID = "22222222-2222-4222-8222-222222222222";
const STARTED_AT = "2026-08-17T13:12:00.000Z";
const COMPLETED_AT = "2026-08-23T18:40:00.000Z";

const schedule = {
  id: SCHEDULE_ID,
  company_id: COMPANY_ID,
  job_id: JOB_ID,
  kind: "work",
  status: "scheduled",
  timezone: "America/Chicago",
  all_day: true,
  starts_on: "2026-08-18",
  ends_on: "2026-08-19",
  start_local_time: null,
  end_local_time: null,
  range_start_at: "2026-08-18T05:00:00.000Z",
  range_end_at: "2026-08-20T05:00:00.000Z",
  notes: null,
  created_by_user_id: null,
  updated_by_user_id: null,
  created_at: "2026-08-16T12:00:00.000Z",
  updated_at: "2026-08-16T12:00:00.000Z",
  cancelled_at: null,
  row_version: 1,
};

const rpc = SQL_047.slice(
  SQL_047.indexOf("create or replace function public.complete_job_work_v1"),
  SQL_047.indexOf(
    "revoke all on function public.complete_job_work_v1",
    SQL_047.indexOf("create or replace function public.complete_job_work_v1")
  )
);

describe("047 schema and security contracts", () => {
  test("adds one nullable timestamptz and no production subdomain", () => {
    assert.match(
      SQL_047,
      /add column if not exists completed_at timestamptz null/
    );
    assert.doesNotMatch(SQL_047, /production_completed_at|actual_completed_at/i);
    assert.doesNotMatch(SQL_047, /production_status|completion_status/i);
    assert.doesNotMatch(
      SQL_047,
      /create table(?: if not exists)? public\.job_production/i
    );
    assert.doesNotMatch(SQL_047, /create index/i);
  });

  test("Complete requires completed_at, production_started_at, and ordered timestamps", () => {
    assert.match(SQL_047, /jobs_completed_at_stage_check/);
    assert.match(
      SQL_047,
      /stage = 'complete'[\s\S]*completed_at is not null[\s\S]*production_started_at is not null[\s\S]*completed_at >= production_started_at/
    );
    assert.match(
      SQL_047,
      /stage is distinct from 'complete'[\s\S]*completed_at is null/
    );
  });

  test("completed_at is raw-write protected and immutable", () => {
    assert.match(SQL_047, /jobs_job_complete_guard/);
    assert.match(SQL_047, /completed_at is immutable/);
    assert.match(
      SQL_047,
      /allow_job_complete_write'[\s\S]*complete_job_work_v1/
    );
    assert.match(
      SQL_047,
      /revoke update \(completed_at\)[\s\S]*from authenticated/
    );
    assert.match(SQL_047, /new jobs cannot have completed_at/);
  });

  test("RPC is authenticated, company-scoped, and not anonymous", () => {
    assert.match(
      SQL_047,
      /create or replace function public\.complete_job_work_v1\(p_payload jsonb\)/
    );
    assert.match(SQL_047, /from public\.company_memberships cm/);
    assert.match(SQL_047, /select j\.\*[\s\S]*for update/);
    assert.match(
      SQL_047,
      /revoke all on function public\.complete_job_work_v1\(jsonb\) from anon/
    );
    assert.match(
      SQL_047,
      /grant execute on function public\.complete_job_work_v1\(jsonb\) to authenticated/
    );
    assert.match(
      SQL_047,
      /grant execute on function public\.complete_job_work_v1\(jsonb\) to service_role/
    );
  });

  test("historical migrations stay untouched and 039 remains absent", () => {
    assert.equal(existsSync(join(ROOT, "supabase/migrations/20260817_045_job_schedules.sql")), true);
    assert.equal(existsSync(join(ROOT, "supabase/migrations/20260817_046_job_production_start.sql")), true);
    assert.equal(existsSync(join(ROOT, "supabase/migrations/20260823_047_job_work_complete.sql")), true);
    const migrations = [
      "20260816_038_job_lifecycle_foundation.sql",
      "20260817_045_job_schedules.sql",
      "20260817_046_job_production_start.sql",
    ];
    for (const name of migrations) {
      assert.doesNotMatch(
        readFileSync(join(ROOT, "supabase/migrations", name), "utf8"),
        /complete_job_work_v1|jobs\.completed_at/
      );
    }
    const migrationNames = readdirSync(join(ROOT, "supabase/migrations"));
    assert.equal(
      migrationNames.some((name) => /039/.test(name)),
      false
    );
    assert.match(SQL_045, /create table if not exists public\.job_schedules/);
    assert.match(SQL_046, /start_job_work_v1/);
  });
});

describe("Complete transaction contracts", () => {
  test("requires exactly one canonical planned work schedule", () => {
    assert.match(rpc, /kind = 'work'/);
    assert.match(rpc, /status = 'scheduled'/);
    assert.match(rpc, /v_planned_count <> 1/);
    assert.match(rpc, /complete_work_schedule_integrity_error/);
    assert.match(rpc, /canonical planned work schedule/);
    assert.doesNotMatch(rpc, /active writable schedule/i);
  });

  test("preserves planned schedule truth and production_started_at", () => {
    assert.doesNotMatch(rpc, /update public\.job_schedules/);
    assert.doesNotMatch(rpc, /row_version\s*=/);
    assert.doesNotMatch(rpc, /production_started_at = v_now/);
    assert.match(rpc, /'production_started_at', v_job\.production_started_at/);
  });

  test("uses one DB time for Complete entry and completed_at", () => {
    assert.match(rpc, /v_now timestamptz := transaction_timestamp\(\)/);
    assert.match(rpc, /stage = 'complete'/);
    assert.match(rpc, /completed_at = v_now/);
    assert.match(rpc, /stage_entered_at = v_now/);
  });

  test("writes one visible fact and paired lifecycle truth", () => {
    assert.match(rpc, /'job_work_completed'/);
    assert.match(rpc, /'stage_changed'/);
    assert.match(rpc, /'reason', 'work_completed'/);
    assert.match(SQL_047, /'job_work_completed'[\s\S]*event_type_reserved/);
  });

  test("is idempotent under the same Job lock", () => {
    assert.match(rpc, /if v_from = 'complete' then[\s\S]*'idempotent', true/);
    const idempotentBranch = rpc.slice(
      rpc.indexOf("if v_from = 'complete' then"),
      rpc.indexOf("perform set_config", rpc.indexOf("if v_from = 'complete' then"))
    );
    assert.doesNotMatch(idempotentBranch, /job_lifecycle_insert_activity/);
    assert.doesNotMatch(idempotentBranch, /completed_at = v_now/);
  });

  test("blocks non-active dispositions without payment/signature gates", () => {
    assert.match(rpc, /v_job\.status <> 'active'/);
    assert.match(rpc, /disposition_blocks_complete/);
    assert.doesNotMatch(
      rpc,
      /job_payment|proposal_signature|proposal_acceptance|deposit_received/
    );
    assert.doesNotMatch(rpc, /status = 'closed'|status = 'lost'|archived = true/);
  });

  test("generic transition remains blocked from Complete", () => {
    assert.equal(JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED, false);
    assert.equal(isAllowedStageEdge("production", "complete"), false);
    assert.equal(
      previewStageTransition({ stage: "production" }, "complete")
        .blockedUntilCompleteAction,
      true
    );
    assert.match(SQL_038, /complete_blocked_until_complete_action/);
    assert.doesNotMatch(
      SQL_047,
      /create or replace function public\.transition_job_stage_v1/
    );
    assert.doesNotMatch(
      SQL_047,
      /JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED = true/
    );
  });
});

describe("R3H TypeScript contracts", () => {
  test("builds the minimal RPC payload", () => {
    assert.equal(COMPLETE_JOB_WORK_RPC_V1, "complete_job_work_v1");
    assert.deepEqual(buildCompleteJobWorkPayload(COMPANY_ID, JOB_ID), {
      company_id: COMPANY_ID,
      job_id: JOB_ID,
    });
  });

  test("parses canonical Complete truth", () => {
    const result = parseCompleteJobWorkResult({
      ok: true,
      idempotent: false,
      job_id: JOB_ID,
      from_stage: "production",
      to_stage: "complete",
      completed_at: COMPLETED_AT,
      production_started_at: STARTED_AT,
      stage_entered_at: COMPLETED_AT,
      disposition_unchanged: "active",
      schedule,
      activity_id: "33333333-3333-4333-8333-333333333333",
      stage_activity_id: "44444444-4444-4444-8444-444444444444",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.completed_at, result.stage_entered_at);
    assert.equal(result.production_started_at, STARTED_AT);
    assert.equal(result.schedule.id, SCHEDULE_ID);
    assert.equal(result.schedule.status, "scheduled");
    assert.equal(result.schedule.row_version, 1);
  });

  test("formats completed_at in its planned schedule timezone", () => {
    const value = formatJobCompletedAt(COMPLETED_AT, "America/Chicago");
    assert.match(value ?? "", /Aug 23/);
  });

  test("Activity shows Work completed and suppresses paired stage noise", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "job_work_completed",
          occurred_at: COMPLETED_AT,
          payload_json: {
            completed_at: COMPLETED_AT,
            production_started_at: STARTED_AT,
            planned_window: schedule,
          },
        },
        {
          id: "66666666-6666-4666-8666-666666666666",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "stage_changed",
          occurred_at: COMPLETED_AT,
          payload_json: {
            from_stage: "production",
            to_stage: "complete",
            reason: "work_completed",
          },
        },
      ],
    });
    assert.equal(items.filter((item) => item.label === "Work completed").length, 1);
    assert.equal(items.some((item) => item.label === "Moved to Complete"), false);
  });
});

describe("R3H surface contracts", () => {
  test("Job Card Production exposes Complete job and read-only planned schedule", () => {
    assert.match(JOB_CARD, /data-jobcard-complete-job/);
    assert.match(JOB_CARD, /Complete job/);
    assert.match(JOB_CARD, /isProduction && Boolean\(planned\) && Boolean\(onCompleteJob\)/);
    assert.match(JOB_CARD, /isProduction \|\| isComplete/);
    assert.match(JOB_CARD, /Work completed/);
    assert.match(JOB_CARD, /data-jobcard-work-completed/);
    assert.match(JOB_CARD, /completedAt/);
    assert.doesNotMatch(JOB_CARD, /Are you sure|can.?t be undone|Undo Complete|Reopen/);
    assert.match(ROOFING_CLIENT, /\/api\/jobs\/complete-work/);
    assert.match(ROOFING_CLIENT, /jobCardActionEligibility\.canCompleteJob/);
    assert.match(API_ROUTE, /completeJobWorkViaRpc/);
  });

  test("Job Card waits for browser session and does not resolve missing hydrate as Intake", () => {
    assert.match(ROOFING_CLIENT, /ensureBrowserAuthSession/);
    assert.match(ROOFING_CLIENT, /INITIAL_SESSION/);
    assert.match(ROOFING_CLIENT, /setJobHydrateStatus\("loading"\)/);
    assert.match(
      ROOFING_CLIENT,
      /jobHydrateStatus !== "unavailable"\s*\?\s*"Loading"/
    );
    assert.match(ROOFING_CLIENT, /serverJobRecord/);
    assert.match(ROOFING_CLIENT, /resolveInitialServerJobSeed/);
    assert.match(ROOFING_CLIENT, /shouldSkipClientCanonicalJobHydrate/);
    assert.match(ROOFING_CLIENT, /matchingServerJobRecord/);
    assert.match(ROOFING_CLIENT, /initialTrustedServerJobSeed/);
    assert.match(ROOFING_CLIENT, /seedOnTimeout/);
    assert.match(ROOFING_CLIENT, /shouldSkipClientCanonicalJobHydrate/);
    const PAGE = readFileSync(join(ROOT, "app/tools/roofing/page.tsx"), "utf8");
    assert.match(PAGE, /getJobRecordForCompany/);
    assert.match(PAGE, /serverJobRecord=\{serverJobRecord\}/);
    const JOB_STORE = readFileSync(join(ROOT, "app/lib/jobStore.ts"), "utf8");
    assert.match(JOB_STORE, /ensureBrowserAuthSession/);
    assert.match(JOB_STORE, /getJobRecordForCompany/);
    assert.match(ROOFING_CLIENT, /refreshHydratedJobRecord/);
    assert.match(API_ROUTE, /completeJobWorkViaRpc/);
  });

  test("server seed helpers enforce route/company match and skip duplicate client hydrate", () => {
    const companyId = COMPANY_ID;
    const jobA = "a29d99f4-89ae-4d2c-97d1-6d2cb3db1cf1";
    const jobB = "ea03234d-2dde-4fa4-aa15-ca1aa1a344e5";
    const productionRecord: JobRecord = {
      id: jobA,
      company_id: companyId,
      customer_id: null,
      job_name: "[R3G-046] Security",
      stage: "production",
      status: "active",
      source: "manual",
      priority: null,
      contact: null,
      address: null,
      assigned_to: null,
      created_by: null,
      updated_by: null,
      notes: null,
      summary: null,
      last_activity_at: null,
      stage_entered_at: STARTED_AT,
      production_started_at: STARTED_AT,
      completed_at: null,
      created_at: STARTED_AT,
      updated_at: STARTED_AT,
      archived: false,
      deleted_at: null,
      selected_measurement_id: null,
      active_proposal_id: null,
      latest_estimate_id: null,
      latest_proposal_id: null,
      source_metadata: null,
      custom_fields: null,
    };

    const deepLink = {
      entryMode: "job-card",
      loadSavedId: null,
      isBoardOriginParam: false,
      jobCardBoardOrigin: false,
      jobParam: jobA,
    };

    assert.equal(
      resolveInitialServerJobSeed({
        ...deepLink,
        companyId,
        serverJobRecord: productionRecord,
      })?.stage,
      "production"
    );
    assert.equal(
      shouldSkipClientCanonicalJobHydrate({
        ...deepLink,
        companyId,
        serverJobRecord: productionRecord,
      }),
      true
    );
    assert.equal(
      matchingServerJobRecord(productionRecord, jobB, companyId),
      null
    );
    assert.equal(
      matchingServerJobRecord(productionRecord, jobA, "00000000-0000-4000-8000-000000000099"),
      null
    );
    assert.equal(
      resolveInitialServerJobSeed({
        ...deepLink,
        jobParam: jobB,
        companyId,
        serverJobRecord: productionRecord,
      }),
      null
    );
    assert.equal(
      isCleanDbJobCardDeepLink({ ...deepLink, isBoardOriginParam: true }),
      false
    );
    assert.equal(
      shouldSkipClientCanonicalJobHydrate({
        entryMode: "job-card",
        loadSavedId: null,
        isBoardOriginParam: false,
        jobCardBoardOrigin: false,
        jobParam: jobA,
        companyId,
        serverJobRecord: null,
      }),
      false
    );
  });

  test("Production schedule hydration is independent from timezone and browser session", () => {
    assert.match(ROOFING_CLIENT, /parseJobCardSchedulesApiPayload/);
    assert.match(ROOFING_CLIENT, /shouldRetryJobCardScheduleFetch/);
    assert.match(ROOFING_CLIENT, /scheduleHydrateRetryTick/);
    assert.match(
      ROOFING_CLIENT,
      /\/api\/jobs\/schedules\?jobId=\$\{encodeURIComponent\(currentJobId\)\}/
    );
    assert.doesNotMatch(
      ROOFING_CLIENT,
      /Promise\.all\([\s\S]*\/api\/jobs\/schedules[\s\S]*\/api\/company\/timezone/
    );
    assert.match(ROOFING_CLIENT, /setJobSchedulesLoadedForJobId\(currentJobId\)/);
    assert.match(ROOFING_CLIENT, /resolveJobCardActiveSchedule/);
    assert.match(JOB_CARD, /isProduction && Boolean\(planned\) && Boolean\(onCompleteJob\)/);
    assert.match(ROOFING_CLIENT, /initialTrustedServerJobSeed/);
    assert.match(ROOFING_CLIENT, /\[entryMode, currentJobId, scheduleActivityTick/);
  });

  test("Board Production uses the same Complete API and Complete lane stays non-payment", () => {
    assert.match(SAVED_CLIENT, /\/api\/jobs\/complete-work/);
    assert.match(SAVED_CLIENT, /showCompleteJobAction/);
    assert.match(BOARD_CARD, /data-board-complete-job/);
    assert.match(BOARD_CARD, /data-board-work-completed/);
    assert.match(SAVED_CLIENT, /Complete job is available from canonical Jobs/);
    assert.match(SAVED_CLIENT, /isDbBoardJobEntry\(est\)[\s\S]*statusTyped === "paid"|statusTyped === "paid"[\s\S]*isDbBoardJobEntry/);
    const row = mapDbJobToBoardEstimate({
      id: JOB_ID,
      company_id: COMPANY_ID,
      stage: "complete",
      status: "active",
      created_at: COMPLETED_AT,
      updated_at: COMPLETED_AT,
      completed_at: COMPLETED_AT,
      production_started_at: STARTED_AT,
    });
    assert.equal(row.status, "paid");
    assert.equal(
      (row as { canonicalBoardLane?: string }).canonicalBoardLane,
      "paid"
    );
    assert.equal((row as { completedAt?: string | null }).completedAt, COMPLETED_AT);
  });

  test("Calendar Complete remains read-only planned truth", () => {
    assert.match(CALENDAR, /event\.stage === "complete"/);
    assert.doesNotMatch(CALENDAR, /Complete job/);
    assert.doesNotMatch(CALENDAR, /\/api\/jobs\/complete-work/);
    assert.match(
      CALENDAR,
      /event\.stage === "complete"[\s\S]*router\.push\(buildDbJobCardHref|router\.push\(buildDbJobCardHref[\s\S]*event\.stage === "complete"/
    );
  });
});
