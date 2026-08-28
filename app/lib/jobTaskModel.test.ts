/**
 * Job task list model — overdue/date-safe sort, deleted exclusion, complete separate.
 * Run: npx tsx --test app/lib/jobTaskModel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildJobTaskWorkspaceView,
  formatTaskDueOn,
  isActiveJobTask,
  isTaskOverdue,
  todayLocalIsoDate,
} from "@/app/lib/jobTaskModel";
import type { JobTaskListItem } from "@/app/lib/jobTaskTypes";

const TODAY = "2026-08-28";

function task(overrides: Partial<JobTaskListItem> = {}): JobTaskListItem {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    title: "Pull permit",
    notes: null,
    status: "open",
    dueOn: "2026-08-31",
    createdAt: "2026-08-20T12:00:00.000Z",
    createdBy: "user-1",
    completedAt: null,
    completedBy: null,
    updatedAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("date-safe overdue", () => {
  test("compares civil dates, not UTC Date midnight", () => {
    assert.equal(isTaskOverdue("2026-08-27", TODAY), true);
    assert.equal(isTaskOverdue("2026-08-28", TODAY), false);
    assert.equal(isTaskOverdue("2026-08-31", TODAY), false);
    assert.equal(isTaskOverdue(null, TODAY), false);
  });

  test("todayLocalIsoDate uses local civil date", () => {
    const local = new Date(2026, 7, 28, 0, 30, 0);
    assert.equal(todayLocalIsoDate(local), "2026-08-28");
    assert.equal(formatTaskDueOn("2026-08-31").length > 0, true);
  });
});

describe("deleted exclusion", () => {
  test("deleted_at rows are not active", () => {
    assert.equal(isActiveJobTask({ deleted_at: null }), true);
    assert.equal(
      isActiveJobTask({ deleted_at: "2026-08-28T12:00:00.000Z" }),
      false
    );
  });
});

describe("open ordering", () => {
  test("overdue, then upcoming due, then no-date; created for ties", () => {
    const overdueLate = task({
      id: "overdue-late",
      title: "Overdue late",
      dueOn: "2026-08-26",
      createdAt: "2026-08-10T00:00:00.000Z",
    });
    const overdueEarly = task({
      id: "overdue-early",
      title: "Overdue early",
      dueOn: "2026-08-25",
      createdAt: "2026-08-11T00:00:00.000Z",
    });
    const upcomingB = task({
      id: "upcoming-b",
      title: "Upcoming B",
      dueOn: "2026-09-02",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const upcomingA = task({
      id: "upcoming-a",
      title: "Upcoming A",
      dueOn: "2026-08-31",
      createdAt: "2026-08-12T00:00:00.000Z",
    });
    const noDateNew = task({
      id: "nodate-new",
      title: "No date new",
      dueOn: null,
      createdAt: "2026-08-22T00:00:00.000Z",
    });
    const noDateOld = task({
      id: "nodate-old",
      title: "No date old",
      dueOn: null,
      createdAt: "2026-08-05T00:00:00.000Z",
    });
    const complete = task({
      id: "complete",
      title: "Done",
      status: "complete",
      dueOn: "2026-08-20",
      completedAt: "2026-08-21T00:00:00.000Z",
    });

    const view = buildJobTaskWorkspaceView({
      tasks: [
        noDateNew,
        upcomingB,
        complete,
        overdueLate,
        noDateOld,
        upcomingA,
        overdueEarly,
      ],
      today: TODAY,
    });

    assert.deepEqual(
      view.openTasks.map((row) => row.id),
      [
        "overdue-early",
        "overdue-late",
        "upcoming-a",
        "upcoming-b",
        "nodate-old",
        "nodate-new",
      ]
    );
    assert.equal(view.completedCount, 1);
    assert.equal(view.completedTasks[0]?.id, "complete");
    assert.equal(view.isEmpty, false);
  });
});

describe("empty", () => {
  test("no tasks is empty", () => {
    const view = buildJobTaskWorkspaceView({ tasks: [], today: TODAY });
    assert.equal(view.isEmpty, true);
    assert.equal(view.openTasks.length, 0);
    assert.equal(view.completedCount, 0);
  });
});
