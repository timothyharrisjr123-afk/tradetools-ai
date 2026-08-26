/**
 * Shared scheduling workspace occupancy, selection, and copy contracts.
 *
 * Run:
 * npx tsx --test app/lib/jobScheduleWorkspace.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  civilDateInInclusiveRange,
  loadScheduleRangeOccupancy,
  monthGridDays,
  monthVisibleCivilRange,
  nextScheduleDateSelection,
  occupancyWindowsFromUnknownEvents,
  parseScheduleRangeReadResult,
  peekScheduleRangeInflightCount,
  resolveScheduleWorkspaceDates,
  SCHEDULE_CONTEXT_ERROR_COPY,
  SCHEDULE_WORKSPACE_FORBIDDEN_COPY,
  scheduledCountLabel,
  scheduledCountAccessibleLabel,
  scheduledJobCountByDay,
  scheduleDayAriaLabel,
  formatCivilDateAccessible,
  scheduleRangeCacheKey,
  scheduleWorkspaceHasCompleteWindow,
  shouldBlockScheduleWriteOnContextError,
} from "./jobScheduleWorkspace";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const SAMPLE_EVENTS = [
  {
    jobId: "job-a",
    schedule: {
      id: "11111111-1111-4111-8111-111111111111",
      company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      job_id: "job-a",
      kind: "work",
      status: "scheduled",
      timezone: "America/Chicago",
      all_day: true,
      starts_on: "2026-08-27",
      ends_on: "2026-08-28",
      start_local_time: null,
      end_local_time: null,
      range_start_at: "x",
      range_end_at: "y",
      notes: null,
      created_by_user_id: null,
      updated_by_user_id: null,
      created_at: "t",
      updated_at: "t",
      cancelled_at: null,
      row_version: 1,
    },
  },
  {
    jobId: "job-b",
    schedule: {
      id: "22222222-2222-4222-8222-222222222222",
      company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      job_id: "job-b",
      kind: "work",
      status: "scheduled",
      timezone: "America/Chicago",
      all_day: true,
      starts_on: "2026-08-28",
      ends_on: "2026-08-28",
      start_local_time: null,
      end_local_time: null,
      range_start_at: "x",
      range_end_at: "y",
      notes: null,
      created_by_user_id: null,
      updated_by_user_id: null,
      created_at: "t",
      updated_at: "t",
      cancelled_at: null,
      row_version: 1,
    },
  },
];

describe("schedule workspace date defaults", () => {
  test("Board/Job Card new schedule does not invent today", () => {
    assert.deepEqual(
      resolveScheduleWorkspaceDates({ mode: "schedule" }),
      { startsOn: "", endsOn: "" }
    );
    assert.equal(
      scheduleWorkspaceHasCompleteWindow({ startsOn: "", endsOn: "" }),
      false
    );
  });

  test("Main Calendar clicked day may prefill", () => {
    assert.deepEqual(
      resolveScheduleWorkspaceDates({
        mode: "schedule",
        prefillStartsOn: "2026-08-27",
      }),
      { startsOn: "2026-08-27", endsOn: "2026-08-27" }
    );
  });

  test("reschedule populates existing window", () => {
    assert.deepEqual(
      resolveScheduleWorkspaceDates({
        mode: "reschedule",
        existingSchedule: { starts_on: "2026-08-24", ends_on: "2026-08-25" },
      }),
      { startsOn: "2026-08-24", endsOn: "2026-08-25" }
    );
  });
});

describe("date selection", () => {
  test("first click sets a single day; second click extends range", () => {
    const first = nextScheduleDateSelection(
      { startsOn: "", endsOn: "" },
      "2026-08-27"
    );
    assert.deepEqual(first, { startsOn: "2026-08-27", endsOn: "2026-08-27" });
    const range = nextScheduleDateSelection(first, "2026-08-29");
    assert.deepEqual(range, { startsOn: "2026-08-27", endsOn: "2026-08-29" });
  });
});

describe("factual occupancy counts", () => {
  test("counts unique overlapping schedules per day without N+1", () => {
    const days = ["2026-08-27", "2026-08-28", "2026-08-29"];
    const windows = occupancyWindowsFromUnknownEvents(SAMPLE_EVENTS);
    const counts = scheduledJobCountByDay(windows, days);
    assert.equal(counts["2026-08-27"], 1);
    assert.equal(counts["2026-08-28"], 2);
    assert.equal(counts["2026-08-29"], 0);
    assert.equal(scheduledCountLabel(0), "");
    assert.equal(scheduledCountLabel(2), "2 jobs");
    assert.equal(scheduledCountLabel(1), "1 job");
    assert.equal(civilDateInInclusiveRange("2026-08-28", "2026-08-27", "2026-08-28"), true);
  });

  test("month grid is 42 days from Monday", () => {
    const days = monthGridDays(2026, 7);
    assert.equal(days.length, 42);
    const range = monthVisibleCivilRange(2026, 7);
    assert.equal(range.firstVisibleOn, days[0]);
    assert.ok(range.afterLastVisibleOn > days[41]);
  });

  test("context error does not block writes and is not empty-world", () => {
    assert.equal(shouldBlockScheduleWriteOnContextError("error"), false);
    assert.match(SCHEDULE_CONTEXT_ERROR_COPY, /Could not load other scheduled work/);
  });

  test("aria labels stay factual with date context", () => {
    assert.equal(formatCivilDateAccessible("2026-08-24"), "August 24");
    assert.equal(scheduledCountAccessibleLabel(0), "");
    assert.equal(scheduledCountAccessibleLabel(1), "1 scheduled job");
    assert.equal(scheduledCountAccessibleLabel(2), "2 scheduled jobs");
    assert.equal(
      scheduleDayAriaLabel({
        iso: "2026-08-24",
        count: 2,
        selected: true,
        thisJob: true,
      }),
      "August 24, 2 scheduled jobs, selected for this job"
    );
    assert.equal(
      scheduleDayAriaLabel({
        iso: "2026-08-24",
        count: 1,
        selected: false,
        thisJob: false,
      }),
      "August 24, 1 scheduled job"
    );
  });
});

describe("bounded coalesced range read", () => {
  test("cache key is from|to and concurrent reads share one inflight", async () => {
    assert.equal(
      scheduleRangeCacheKey("a", "b"),
      "a|b"
    );
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        ok: true,
        json: async () => ({ ok: true, events: SAMPLE_EVENTS }),
      } as Response;
    };
    const first = loadScheduleRangeOccupancy({
      fromIso: "2026-08-01T00:00:00.000Z",
      toIso: "2026-09-01T00:00:00.000Z",
      fetchImpl,
    });
    assert.equal(peekScheduleRangeInflightCount(), 1);
    const second = loadScheduleRangeOccupancy({
      fromIso: "2026-08-01T00:00:00.000Z",
      toIso: "2026-09-01T00:00:00.000Z",
      fetchImpl,
    });
    const [a, b] = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.equal(a.status, "ready");
    assert.equal(b.windows.length, 2);
  });

  test("parse rejects non-ok as error, not empty ready", () => {
    assert.deepEqual(parseScheduleRangeReadResult(false, { events: [] }), {
      status: "error",
    });
  });
});

describe("surface ownership and forbidden wording", () => {
  const files = [
    "app/tools/roofing/jobCard/JobScheduleWorkspace.tsx",
    "app/tools/roofing/jobCard/JobScheduleMonthGrid.tsx",
    "app/tools/roofing/jobCard/ScheduleJobModal.tsx",
    "app/tools/roofing/jobCard/JobCardScheduleWorkspacePanel.tsx",
  ];

  test("workspace files do not claim capacity or recommendations", () => {
    for (const rel of files) {
      const source = read(rel).toLowerCase();
      for (const word of SCHEDULE_WORKSPACE_FORBIDDEN_COPY) {
        assert.equal(source.includes(word), false, `${rel} contains ${word}`);
      }
      assert.doesNotMatch(source, / is full/);
      assert.doesNotMatch(source, />Busy</);
      assert.doesNotMatch(source, /Available/);
    }
  });

  test("Board, Job Card Calendar, and Main Calendar share ScheduleJobModal/workspace", () => {
    assert.match(read("app/tools/roofing/saved/SavedClient.tsx"), /ScheduleJobModal/);
    assert.match(
      read("app/tools/roofing/jobCard/JobCardClient.tsx"),
      /JobCardScheduleWorkspacePanel/
    );
    assert.match(
      read("app/tools/roofing/calendar/FieldDiveCalendarClient.tsx"),
      /ScheduleJobModal/
    );
    assert.match(
      read("app/tools/roofing/jobCard/ScheduleJobModal.tsx"),
      /JobScheduleWorkspace/
    );
  });

  test("Quick Links block is gone; Measurements/Proposals/Attachments tabs remain", () => {
    const overview = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");
    assert.doesNotMatch(overview, /Quick links/);
    const types = read("app/tools/roofing/jobCard/jobCardTypes.ts");
    assert.match(types, /"measurements"/);
    assert.match(types, /"proposals"/);
    assert.match(types, /"attachments"/);
    assert.match(types, /JOB_CARD_VISIBLE_TAB_IDS/);
  });

  test("Job Card Calendar tab no longer primarily bounces to company Calendar", () => {
    assert.match(
      read("app/tools/roofing/jobCard/JobCardScheduleWorkspacePanel.tsx"),
      /JobScheduleWorkspace/
    );
    const workspace = read("app/tools/roofing/jobCard/JobScheduleWorkspace.tsx");
    assert.match(workspace, /View company Calendar/);
    const timeline = read("app/tools/roofing/jobCard/JobCardScheduleTimeline.tsx");
    assert.doesNotMatch(timeline, /Open company Calendar/);
    assert.doesNotMatch(timeline, /onReschedule/);
  });

  test("Unschedule confirm can keep the current schedule", () => {
    const workspace = read("app/tools/roofing/jobCard/JobScheduleWorkspace.tsx");
    assert.match(workspace, /Keep scheduled/);
    assert.match(workspace, /data-schedule-unschedule-keep/);
    assert.match(workspace, /data-schedule-unschedule-confirm/);
  });

  test("Board Approved Schedule job does not invent a date", () => {
    const source = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.match(source, /openBoardScheduleWorkspace/);
    const match = source.match(
      /const openBoardScheduleWorkspace = useCallback\(\s*\(job: RoofingEstimate\) => \{[\s\S]*?setR3fScheduleModal\(\{[\s\S]*?\}\);/
    );
    assert.ok(match);
    assert.match(match[0], /mode: "schedule"/);
    assert.match(match[0], /schedule: null/);
    assert.doesNotMatch(match[0], /startsOn/);
  });

  test("Main Calendar day-create may prefill the clicked day", () => {
    assert.match(
      read("app/tools/roofing/calendar/FieldDiveCalendarClient.tsx"),
      /startsOn: pickerDate/
    );
  });

  test("Board Schedule job control is a dedicated Board action", () => {
    assert.match(
      read("app/tools/roofing/saved/components/JobsBoardCard.tsx"),
      /data-board-schedule-job/
    );
  });

  test("month grid shows 1 job / N jobs, not a bare numeral", () => {
    const grid = read("app/tools/roofing/jobCard/JobScheduleMonthGrid.tsx");
    assert.match(grid, /scheduledCountLabel/);
    assert.match(grid, /data-schedule-day-count-label/);
    assert.doesNotMatch(grid, />\{count\}</);
    assert.doesNotMatch(grid.toLowerCase(), /busy|available|capacity|recommended/);
  });

  test("does not write jobs.stage from the workspace", () => {
    const workspace = read("app/tools/roofing/jobCard/JobScheduleWorkspace.tsx");
    assert.doesNotMatch(workspace, /jobs\.stage/);
    assert.doesNotMatch(workspace, /allow_stage_write/);
    assert.match(
      read("app/tools/roofing/saved/SavedClient.tsx"),
      /\/api\/jobs\/schedule/
    );
  });
});
