/**
 * Tasks V1 — Job Card workspace UI, store source, Complete regression.
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardTasksV1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveCanonicalJobActionEligibilityFromFacts } from "@/app/lib/jobLifecycleActionEligibility";
import type { JobTaskListItem } from "@/app/lib/jobTaskTypes";
import {
  JOB_TASKS_ADD_LABEL,
  JOB_TASKS_EMPTY,
} from "@/app/lib/jobTaskTypes";
import JobCardTasksWorkspace from "@/app/tools/roofing/jobCard/JobCardTasksWorkspace";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
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

const OPEN = [
  task({ id: "t-overdue", title: "Pull permit", dueOn: "2026-08-27" }),
  task({ id: "t-upcoming", title: "Pick up ridge vent", dueOn: "2026-08-31" }),
  task({
    id: "t-nodate",
    title: "Call homeowner",
    dueOn: null,
    createdAt: "2026-08-21T12:00:00.000Z",
  }),
];

const COMPLETED = [
  task({
    id: "t-done-1",
    title: "Send warranty",
    status: "complete",
    dueOn: null,
    completedAt: "2026-08-22T12:00:00.000Z",
    completedBy: "user-1",
  }),
  task({
    id: "t-done-2",
    title: "Magnet sweep",
    status: "complete",
    dueOn: "2026-08-20",
    completedAt: "2026-08-21T12:00:00.000Z",
    completedBy: "user-1",
  }),
];

const noop = {
  onCreate: () => true,
  onUpdate: () => true,
  onComplete: () => undefined,
  onReopen: () => undefined,
  onRemove: () => true,
};

function render(props: Partial<Parameters<typeof JobCardTasksWorkspace>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(JobCardTasksWorkspace, {
      activeTab: "tasks",
      tasks: [],
      today: TODAY,
      ...noop,
      ...props,
    })
  );
}

describe("UI model", () => {
  test("empty", () => {
    const html = render({ tasks: [] });
    assert.match(html, new RegExp(JOB_TASKS_EMPTY));
    assert.match(html, new RegExp(JOB_TASKS_ADD_LABEL));
    assert.doesNotMatch(html, /stay organized|checklist|onboarding/i);
    assert.doesNotMatch(html, /data-jobcard-tasks-open/);
  });

  test("open list and overdue quiet due date", () => {
    const html = render({ tasks: OPEN });
    assert.match(html, /data-jobcard-tasks-open/);
    assert.match(html, /Pull permit/);
    assert.match(html, /Pick up ridge vent/);
    assert.match(html, /Call homeowner/);
    assert.match(html, /data-jobcard-task-overdue="true"/);
    assert.match(html, /data-jobcard-task-complete/);
    assert.doesNotMatch(html, /Attention|Are you sure|success/i);
  });

  test("Add form", () => {
    const html = render({ tasks: [], initialAdding: true });
    assert.match(html, /data-jobcard-task-add-form/);
    assert.match(html, /data-jobcard-task-title-input/);
    assert.match(html, /data-jobcard-task-due-input/);
    assert.match(html, /data-jobcard-task-notes-input/);
    assert.match(html, /Cancel/);
  });

  test("completed collapsed by default", () => {
    const html = render({ tasks: [...OPEN, ...COMPLETED] });
    assert.match(html, /Completed \(2\)/);
    assert.doesNotMatch(html, /data-jobcard-tasks-completed-list/);
    assert.doesNotMatch(html, /Send warranty/);
  });

  test("completed expanded with reopen", () => {
    const html = render({
      tasks: [...OPEN, ...COMPLETED],
      initialCompletedOpen: true,
    });
    assert.match(html, /data-jobcard-tasks-completed-list/);
    assert.match(html, /Send warranty/);
    assert.match(html, /data-jobcard-task-reopen/);
  });

  test("edit form on a row", () => {
    const html = render({
      tasks: OPEN,
      initialEditingId: "t-upcoming",
    });
    assert.match(html, /data-jobcard-task-form/);
    assert.match(html, /data-jobcard-task-remove/);
    assert.match(html, /Save/);
  });
});

describe("live wiring", () => {
  test("Job Card uses the tasks workspace", () => {
    const secondary = read("app/tools/roofing/jobCard/JobCardSecondaryPanels.tsx");
    assert.match(secondary, /JobCardTasksWorkspace/);
    assert.match(secondary, /useJobCardTasks/);
    assert.doesNotMatch(secondary, /quiet\("tasks"/);
  });
});

describe("store / API source", () => {
  const persist = read("app/lib/jobTaskPersistence.ts");
  const listRoute = read("app/api/jobs/[jobId]/tasks/route.ts");
  const itemRoute = read("app/api/jobs/[jobId]/tasks/[taskId]/route.ts");

  test("create list edit complete reopen soft-delete; server stamps completion", () => {
    assert.match(persist, /export async function createJobTask/);
    assert.match(persist, /export async function listJobTasks/);
    assert.match(persist, /export async function updateJobTaskContent/);
    assert.match(persist, /export async function completeJobTask/);
    assert.match(persist, /export async function reopenJobTask/);
    assert.match(persist, /export async function softDeleteJobTask/);
    assert.match(persist, /status: "open"/);
    assert.match(persist, /completed_at: new Date\(\)\.toISOString\(\)/);
    assert.match(persist, /completed_by: input\.ctx\.userId/);
    assert.match(persist, /completed_at: null/);
    assert.match(persist, /deleted_at: new Date\(\)\.toISOString\(\)/);
    assert.doesNotMatch(persist, /body\.completedAt|input\.completedAt/);
    assert.match(listRoute, /export async function GET/);
    assert.match(listRoute, /export async function POST/);
    assert.match(itemRoute, /export async function PATCH/);
    assert.match(itemRoute, /export async function DELETE/);
    assert.match(persist, /\.is\("deleted_at", null\)/);
  });
});

describe("Complete job ignores tasks", () => {
  test("Production + planned schedule remains completable without task input", () => {
    const eligibility = resolveCanonicalJobActionEligibilityFromFacts({
      stage: "production",
      disposition: "active",
      schedule: { kind: "work", status: "scheduled" },
    });
    assert.equal(eligibility.canCompleteJob, true);
    const source = read("app/lib/jobLifecycleActionEligibility.ts");
    assert.doesNotMatch(source, /job_tasks|openTask|taskCount|completedCount/);
  });

  test("Complete RPC and UI do not mention tasks", () => {
    const sql = read("supabase/migrations/20260823_047_job_work_complete.sql");
    const route = read("app/api/jobs/complete-work/route.ts");
    const next = read("app/tools/roofing/jobCard/JobCardNextActionPanel.tsx");
    assert.doesNotMatch(sql, /job_tasks/);
    assert.doesNotMatch(route, /job_tasks/);
    assert.doesNotMatch(next, /finish all tasks|You must finish/i);
  });
});
