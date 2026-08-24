/**
 * Wave 1 — canonical surface ownership, truthful failure states, stale-response safety.
 *
 * Run: npx tsx --test app/lib/canonicalSurfaceOwnership.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  applyBoardCanonicalJobsFailure,
  applyBoardCanonicalJobsSuccess,
  boardCanonicalLifecycleActionsEnabled,
  createInitialBoardCanonicalJobsSnapshot,
  isBoardEmptyCompanyState,
} from "./boardCanonicalReadState";
import {
  isCanonicalJobsBoardSurface,
  isLegacyEstimateLaneSurface,
  restoreCanonicalBoardFromReturnStatus,
} from "./boardCanonicalSurface";
import {
  isFabricatedEmptyScheduleWorld,
  isTrueEmptySchedule,
  nextEventsAfterScheduleFailure,
  nextEventsAfterTimezoneFailure,
  parseCalendarScheduleEventsResult,
  shouldApplyCalendarLoadResult,
  timezoneForCalendarRangeRead,
  type CalendarVisibleRange,
} from "./calendarScheduleLoadOwnership";
import {
  beginCoalescedRefresh,
  createInitialCoalescedRefreshState,
  finishCoalescedRefresh,
  isCoalescedRefreshCurrent,
} from "./coalescedRefresh";
import { shouldApplyJobCardRefreshResult } from "./jobCardRefreshGuard";
import type { JobRecord, JobSummary } from "./jobTypes";

const ROOT = process.cwd();
const SAVED_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/saved/SavedClient.tsx"),
  "utf8"
);
const BOARD_COLUMN = readFileSync(
  join(ROOT, "app/tools/roofing/saved/components/JobsBoardColumn.tsx"),
  "utf8"
);
const USE_BOARD = readFileSync(
  join(ROOT, "app/tools/roofing/saved/useBoardCanonicalJobs.ts"),
  "utf8"
);
const CALENDAR = readFileSync(
  join(ROOT, "app/tools/roofing/calendar/FieldDiveCalendarClient.tsx"),
  "utf8"
);
const CANONICAL_READ = readFileSync(
  join(ROOT, "app/tools/roofing/jobCard/useJobCardCanonicalRead.ts"),
  "utf8"
);
const ATTENTION_HOOK = readFileSync(
  join(ROOT, "app/lib/useJobAttention.ts"),
  "utf8"
);

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_A = "11111111-1111-4111-8111-111111111111";
const JOB_B = "22222222-2222-4222-8222-222222222222";

function jobSummary(id: string, stage: JobSummary["stage"]): JobSummary {
  return {
    id,
    company_id: COMPANY_ID,
    customer_name: "Test",
    customer_email: null,
    customer_phone: null,
    job_name: "Test — roofing",
    address: null,
    stage,
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
    production_started_at: null,
    completed_at: null,
  };
}

function jobRecord(id: string): JobRecord {
  return {
    id,
    company_id: COMPANY_ID,
    customer_id: null,
    job_name: "Canonical",
    stage: "scheduled",
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
    production_started_at: null,
    completed_at: null,
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

describe("Wave 1 — Board canonical header ownership", () => {
  test("canonical lifecycle headers restore onto the Jobs Board, not the legacy lane", () => {
    for (const filter of ["approved", "scheduled", "in_progress", "paid"] as const) {
      const restored = restoreCanonicalBoardFromReturnStatus(filter);
      assert.equal(restored.statusFilter, "all");
      assert.equal(isCanonicalJobsBoardSurface(restored.statusFilter), true);
      assert.equal(isLegacyEstimateLaneSurface(restored.statusFilter), false);
    }
    assert.equal(
      restoreCanonicalBoardFromReturnStatus("scheduled").focusedColumnKey,
      "scheduled"
    );
    assert.equal(
      restoreCanonicalBoardFromReturnStatus("approved").focusedColumnKey,
      "approved"
    );
    assert.equal(
      restoreCanonicalBoardFromReturnStatus("in_progress").focusedColumnKey,
      "in_progress"
    );
    assert.equal(
      restoreCanonicalBoardFromReturnStatus("paid").focusedColumnKey,
      "paid"
    );
  });

  test("canonical header path cannot land in legacy-only rendering", () => {
    assert.match(SAVED_CLIENT, /onFocusColumn=\{\(\) => focusCanonicalColumn\(column\.key\)\}/);
    assert.match(SAVED_CLIENT, /restoreCanonicalBoardFromReturnStatus/);
    assert.match(BOARD_COLUMN, /data-canonical-column-header=\{column\.key\}/);
    assert.doesNotMatch(SAVED_CLIENT, /setStatusFilter\(column\.listFilter\)/);
    assert.doesNotMatch(BOARD_COLUMN, /onOpenLane/);
    assert.match(SAVED_CLIENT, /data-canonical-jobs-board/);
    assert.match(SAVED_CLIENT, /data-legacy-estimate-lane/);
    assert.match(BOARD_COLUMN, /data-jobs-board-column=\{column\.key\}/);
  });

  test("Scheduled header retains canonical DB jobs via column focus, not estimate statuses", () => {
    assert.match(
      SAVED_CLIENT,
      /getJobsForBoardColumn\(boardVisibleJobs, column\.key\)/
    );
    assert.match(SAVED_CLIENT, /focusedCanonicalColumn == null \|\| k === focusedCanonicalColumn/);
    assert.doesNotMatch(
      SAVED_CLIENT,
      /onFocusColumn=\{\(\) => setStatusFilter/
    );
  });
});

describe("Wave 1 — Board error vs empty company", () => {
  test("initial jobs read error is not an empty Board", () => {
    let snap = createInitialBoardCanonicalJobsSnapshot<JobSummary>();
    snap = applyBoardCanonicalJobsFailure(snap);
    assert.equal(snap.status, "error");
    assert.equal(isBoardEmptyCompanyState(snap), false);
    assert.equal(boardCanonicalLifecycleActionsEnabled(snap), false);
    assert.match(USE_BOARD, /applyBoardCanonicalJobsFailure/);
    assert.match(SAVED_CLIENT, /data-jobs-board-read-status=\{dbJobsStatus\}/);
    assert.match(SAVED_CLIENT, /JobsBoardErrorState/);
    assert.doesNotMatch(USE_BOARD, /setDbJobs\(\[\]\);\s*setDbJobsLoaded\(true\)/);
  });

  test("refresh error preserves prior good canonical jobs and retry can recover", () => {
    let snap = createInitialBoardCanonicalJobsSnapshot<JobSummary>();
    const scheduled = jobSummary(JOB_A, "scheduled");
    snap = applyBoardCanonicalJobsSuccess(snap, [scheduled]);
    assert.equal(isBoardEmptyCompanyState(snap), false);
    snap = applyBoardCanonicalJobsFailure(snap);
    assert.equal(snap.status, "ready");
    assert.equal(snap.refreshError, true);
    assert.equal(snap.jobs.length, 1);
    assert.equal(snap.jobs[0]?.id, JOB_A);
    assert.equal(boardCanonicalLifecycleActionsEnabled(snap), true);
    snap = applyBoardCanonicalJobsSuccess(snap, [
      scheduled,
      jobSummary(JOB_B, "approved"),
    ]);
    assert.equal(snap.refreshError, false);
    assert.equal(snap.jobs.length, 2);
  });
});

describe("Wave 1 — Calendar timezone vs schedule truth", () => {
  test("timezone error does not fabricate zero schedules", () => {
    const kept = nextEventsAfterTimezoneFailure([{ id: "evt-1" }]);
    assert.equal(kept.length, 1);
    assert.equal(
      isFabricatedEmptyScheduleWorld({
        timezoneKind: "error",
        scheduleStatus: "blocked",
        eventsLength: 1,
      }),
      false
    );
    assert.match(CALENDAR, /timezoneForCalendarRangeRead/);
    assert.match(CALENDAR, /setScheduleLoadStatus\("blocked"\)/);
    assert.doesNotMatch(
      CALENDAR,
      /setTimezoneLoadStatus\("error"\);[\s\S]{0,80}setEvents\(\[\]\)/
    );
  });

  test("timezone not_set does not fabricate an empty month", () => {
    assert.equal(
      timezoneForCalendarRangeRead({
        currentTimezone: null,
        lastKnownTimezone: "America/Chicago",
        timezoneLoadStatus: "ready",
      }),
      null
    );
    assert.equal(
      isFabricatedEmptyScheduleWorld({
        timezoneKind: "not_set",
        scheduleStatus: "blocked",
        eventsLength: 0,
      }),
      false
    );
    assert.match(CALENDAR, /data-calendar-schedule-blocked/);
    assert.match(CALENDAR, /data-timezone-not-set/);
  });

  test("schedule error is distinct from empty schedule", () => {
    const kept = nextEventsAfterScheduleFailure([{ id: "evt-1" }]);
    assert.equal(kept.length, 1);
    assert.equal(
      parseCalendarScheduleEventsResult(false, { events: [] }).status,
      "error"
    );
    assert.deepEqual(
      parseCalendarScheduleEventsResult(true, { events: [] }),
      { status: "ready", events: [] }
    );
    assert.equal(
      isTrueEmptySchedule({
        timezoneKind: "saved",
        scheduleStatus: "ready",
        eventsLength: 0,
      }),
      true
    );
    assert.equal(
      isTrueEmptySchedule({
        timezoneKind: "saved",
        scheduleStatus: "error",
        eventsLength: 0,
      }),
      false
    );
    assert.match(CALENDAR, /data-calendar-schedule-error/);
    assert.match(CALENDAR, /parseCalendarScheduleEventsResult/);
  });

  test("stale old range cannot overwrite current range", () => {
    const monthA: CalendarVisibleRange = {
      view: "month",
      firstVisibleOn: "2026-07-27",
      afterLastVisibleOn: "2026-09-07",
    };
    const monthB: CalendarVisibleRange = {
      view: "month",
      firstVisibleOn: "2026-08-31",
      afterLastVisibleOn: "2026-10-12",
    };
    const weekB: CalendarVisibleRange = {
      view: "week",
      firstVisibleOn: "2026-08-31",
      afterLastVisibleOn: "2026-09-07",
    };
    assert.equal(
      shouldApplyCalendarLoadResult({
        currentGeneration: 2,
        resultGeneration: 1,
        currentRange: monthB,
        resultRange: monthA,
      }),
      false
    );
    assert.equal(
      shouldApplyCalendarLoadResult({
        currentGeneration: 2,
        resultGeneration: 2,
        currentRange: monthB,
        resultRange: monthB,
      }),
      true
    );
    assert.equal(
      shouldApplyCalendarLoadResult({
        currentGeneration: 3,
        resultGeneration: 2,
        currentRange: weekB,
        resultRange: monthB,
      }),
      false
    );
    assert.match(CALENDAR, /shouldApplyCalendarLoadResult/);
    assert.match(CALENDAR, /loadGenerationRef/);
  });
});

describe("Wave 1 — Job Card A→B stale refresh guard", () => {
  test("stale refresh for Job A cannot overwrite Job B", () => {
    const recordA = jobRecord(JOB_A);
    const recordB = jobRecord(JOB_B);
    assert.equal(
      shouldApplyJobCardRefreshResult({
        requestedJobId: JOB_A,
        currentJobId: JOB_B,
        currentCompanyId: COMPANY_ID,
        refreshGeneration: 1,
        currentGeneration: 1,
        record: recordA,
      }),
      false
    );
    assert.equal(
      shouldApplyJobCardRefreshResult({
        requestedJobId: JOB_B,
        currentJobId: JOB_B,
        currentCompanyId: COMPANY_ID,
        refreshGeneration: 2,
        currentGeneration: 2,
        record: recordB,
      }),
      true
    );
    assert.equal(
      shouldApplyJobCardRefreshResult({
        requestedJobId: JOB_A,
        currentJobId: JOB_A,
        currentCompanyId: COMPANY_ID,
        refreshGeneration: 1,
        currentGeneration: 2,
        record: recordA,
      }),
      false
    );
    assert.match(CANONICAL_READ, /shouldApplyJobCardRefreshResult/);
    assert.match(CANONICAL_READ, /jobRefreshGenerationRef/);
  });
});

describe("Wave 1 — Attention focus/pageshow coalescing", () => {
  test("focus + pageshow coalesce and stale Attention result is discarded", () => {
    let state = createInitialCoalescedRefreshState();
    const first = beginCoalescedRefresh(state);
    state = first.state;
    const second = beginCoalescedRefresh(state);
    state = second.state;
    assert.equal(first.shouldRun, true);
    assert.equal(second.shouldRun, false);
    assert.equal(state.pending, true);
    state = finishCoalescedRefresh(state, first.generation).state;
    assert.equal(isCoalescedRefreshCurrent(state, first.generation), false);
    assert.match(ATTENTION_HOOK, /beginCoalescedRefresh/);
    assert.match(ATTENTION_HOOK, /isCoalescedRefreshCurrent/);
    assert.match(ATTENTION_HOOK, /window\.addEventListener\("focus"/);
    assert.match(ATTENTION_HOOK, /window\.addEventListener\("pageshow"/);
  });
});
