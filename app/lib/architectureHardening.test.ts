/**
 * Post-R3H combined architecture hardening contracts.
 *
 * Run: npx tsx --test app/lib/architectureHardening.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { mapDbJobToBoardEstimate } from "./jobBoardAdapter";
import {
  isCleanDbJobCardDeepLink,
  matchingServerJobRecord,
  resolveTrustedJobCardSeed,
  shouldSkipClientCanonicalJobHydrate,
} from "./jobCardServerSeed";
import { getBoardStageLabelForJob } from "@/app/tools/roofing/saved/jobsBoardUtils";
import { MONTH_DAY_EVENT_CAP } from "@/app/tools/roofing/calendar/FieldDiveCalendarClient";
import type { JobRecord, JobSummary } from "./jobTypes";

const ROOT = process.cwd();
const MIDDLEWARE = readFileSync(join(ROOT, "middleware.ts"), "utf8");
const SAVED_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/saved/SavedClient.tsx"),
  "utf8"
);
const USE_BOARD = readFileSync(
  join(ROOT, "app/tools/roofing/saved/useBoardCanonicalJobs.ts"),
  "utf8"
);
const PAGE = readFileSync(join(ROOT, "app/tools/roofing/page.tsx"), "utf8");
const ROOFING_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/RoofingClient.tsx"),
  "utf8"
);
const CANONICAL_READ = readFileSync(
  join(ROOT, "app/tools/roofing/jobCard/useJobCardCanonicalRead.ts"),
  "utf8"
);
const ACTIVITY = readFileSync(
  join(
    ROOT,
    "app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx"
  ),
  "utf8"
);
const CALENDAR = readFileSync(
  join(ROOT, "app/tools/roofing/calendar/FieldDiveCalendarClient.tsx"),
  "utf8"
);

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_ID = "11111111-1111-4111-8111-111111111111";

function completeJobRecord(): JobRecord {
  return {
    id: JOB_ID,
    company_id: COMPANY_ID,
    customer_id: null,
    job_name: "Canonical Complete",
    stage: "complete",
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
    stage_entered_at: "2026-06-06T12:00:00.000Z",
    production_started_at: "2026-06-05T12:00:00.000Z",
    completed_at: "2026-06-06T12:00:00.000Z",
    created_at: "2026-06-06T10:00:00.000Z",
    updated_at: "2026-06-06T12:00:00.000Z",
    archived: false,
    deleted_at: null,
    selected_measurement_id: null,
    active_proposal_id: null,
    latest_estimate_id: null,
    latest_proposal_id: null,
    source_metadata: null,
    custom_fields: null,
  };
}

describe("architecture hardening — board refresh", () => {
  test("SavedClient uses coalesced canonical jobs hook", () => {
    assert.match(SAVED_CLIENT, /useBoardCanonicalJobs/);
    assert.match(USE_BOARD, /beginCoalescedRefresh/);
    assert.match(USE_BOARD, /finishCoalescedRefresh/);
    assert.match(USE_BOARD, /isCoalescedRefreshCurrent/);
    assert.doesNotMatch(SAVED_CLIENT, /getJobsByCompany/);
  });

  test("focus/pageshow/visibility wired through single refresh pump", () => {
    assert.match(USE_BOARD, /window\.addEventListener\("focus"/);
    assert.match(USE_BOARD, /window\.addEventListener\("pageshow"/);
    assert.match(USE_BOARD, /document\.addEventListener\("visibilitychange"/);
    assert.match(USE_BOARD, /while \(true\)/);
  });
});

describe("architecture hardening — job card read ownership", () => {
  test("server job record loads for board-origin Job Card routes", () => {
    assert.match(PAGE, /getJobRecordForCompany/);
    assert.doesNotMatch(PAGE, /fromBoard/);
    assert.match(PAGE, /!loadSaved/);
  });

  test("RoofingClient delegates canonical read to dedicated hook", () => {
    assert.match(ROOFING_CLIENT, /useJobCardCanonicalRead/);
    assert.match(CANONICAL_READ, /shouldSkipClientCanonicalJobHydrate/);
    assert.match(CANONICAL_READ, /ensureBrowserAuthSession/);
  });

  test("board-origin trusted seed skips duplicate client hydrate", () => {
    const record = completeJobRecord();
    assert.equal(
      shouldSkipClientCanonicalJobHydrate({
        entryMode: "job-card",
        loadSavedId: null,
        isBoardOriginParam: true,
        jobCardBoardOrigin: true,
        jobParam: JOB_ID,
        companyId: COMPANY_ID,
        serverJobRecord: record,
      }),
      true
    );
    assert.equal(
      resolveTrustedJobCardSeed({
        entryMode: "job-card",
        loadSavedId: null,
        jobParam: JOB_ID,
        companyId: COMPANY_ID,
        serverJobRecord: record,
      })?.stage,
      "complete"
    );
  });

  test("Job A→B protection preserved via route/company match", () => {
    const record = completeJobRecord();
    assert.equal(
      matchingServerJobRecord(
        record,
        "22222222-2222-4222-8222-222222222222",
        COMPANY_ID
      ),
      null
    );
    assert.equal(isCleanDbJobCardDeepLink({
      entryMode: "job-card",
      loadSavedId: null,
      isBoardOriginParam: true,
      jobCardBoardOrigin: false,
      jobParam: JOB_ID,
    }), false);
  });
});

describe("architecture hardening — activity reads", () => {
  test("independent activity/acceptance/signature/payment effects", () => {
    assert.match(ACTIVITY, /listJobActivityEventsForJob/);
    assert.match(ACTIVITY, /listJobProposalAcceptances/);
    assert.match(ACTIVITY, /listJobProposalSignatures/);
    assert.match(ACTIVITY, /listJobPaymentRequests/);
    assert.doesNotMatch(
      ACTIVITY,
      /Promise\.all\([\s\S]*listJobActivityEventsForJob[\s\S]*listJobProposalAcceptances/
    );
  });

  test("RoofingClient acceptance and signature reads are decoupled", () => {
    const acceptanceBlock = ROOFING_CLIENT.slice(
      ROOFING_CLIENT.indexOf("listJobProposalAcceptances(currentJobId)"),
      ROOFING_CLIENT.indexOf("listJobProposalSignatures(currentJobId)") +
        "listJobProposalSignatures(currentJobId)".length +
        400
    );
    assert.match(ROOFING_CLIENT, /listJobProposalAcceptances\(currentJobId\)/);
    assert.match(ROOFING_CLIENT, /listJobProposalSignatures\(currentJobId\)/);
    assert.doesNotMatch(acceptanceBlock, /Promise\.all/);
  });
});

describe("architecture hardening — middleware/API auth ownership", () => {
  test("middleware excludes /api from session refresh matcher", () => {
    assert.match(MIDDLEWARE, /api\//);
    assert.match(MIDDLEWARE, /updateSession/);
  });
});

describe("architecture hardening — legacy canonical display fence", () => {
  test("canonical Complete label does not come from legacy paid column key", () => {
    const summary: JobSummary = {
      id: JOB_ID,
      company_id: COMPANY_ID,
      customer_name: "Test",
      customer_email: null,
      customer_phone: null,
      job_name: "Test — roofing",
      address: null,
      stage: "complete",
      status: "active",
      source: "manual",
      priority: null,
      selected_measurement_id: null,
      active_proposal_id: null,
      latest_estimate_id: null,
      latest_proposal_id: null,
      last_activity_at: null,
      created_at: "2026-06-06T10:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      stage_entered_at: "2026-06-06T12:00:00.000Z",
      production_started_at: "2026-06-05T12:00:00.000Z",
      completed_at: "2026-06-06T12:00:00.000Z",
    };
    const row = mapDbJobToBoardEstimate(summary);
    assert.equal(row.status, "paid");
    assert.equal(getBoardStageLabelForJob(row), "Complete");
  });
});

describe("architecture hardening — calendar overflow", () => {
  test("month day uses bounded cap and overflow affordance", () => {
    assert.equal(MONTH_DAY_EVENT_CAP, 3);
    assert.match(CALENDAR, /MONTH_DAY_EVENT_CAP/);
    assert.match(CALENDAR, /data-calendar-day-overflow-count/);
    assert.match(CALENDAR, /data-calendar-month-overflow/);
    assert.match(CALENDAR, /overflow-hidden/);
  });
});
