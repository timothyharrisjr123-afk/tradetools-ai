/**
 * Job task workspace view-model helpers.
 * Pure. No I/O. Date-safe due_on comparison (civil YYYY-MM-DD, not UTC Date).
 */

import type { JobTaskListItem, JobTaskRecord } from "@/app/lib/jobTaskTypes";

export function todayLocalIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isActiveJobTask(
  row: Pick<JobTaskRecord, "deleted_at">
): boolean {
  return row.deleted_at == null;
}

export function isTaskOverdue(
  dueOn: string | null | undefined,
  today: string = todayLocalIsoDate()
): boolean {
  if (!dueOn) return false;
  return dueOn < today;
}

export function formatTaskDueOn(dueOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueOn.trim());
  if (!match) return dueOn;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return dueOn;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function toJobTaskListItem(row: JobTaskRecord): JobTaskListItem {
  return {
    id: row.id,
    jobId: row.job_id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    dueOn: row.due_on,
    createdAt: row.created_at,
    createdBy: row.created_by,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    updatedAt: row.updated_at,
  };
}

function compareOpenTasks(
  a: JobTaskListItem,
  b: JobTaskListItem,
  today: string
): number {
  const aOverdue = isTaskOverdue(a.dueOn, today);
  const bOverdue = isTaskOverdue(b.dueOn, today);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

  const aDated = a.dueOn != null;
  const bDated = b.dueOn != null;
  if (aDated !== bDated) return aDated ? -1 : 1;

  if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) {
    return a.dueOn.localeCompare(b.dueOn);
  }

  const byCreated = a.createdAt.localeCompare(b.createdAt);
  if (byCreated !== 0) return byCreated;
  return a.id.localeCompare(b.id);
}

export function sortOpenJobTasks(
  rows: readonly JobTaskListItem[],
  today: string = todayLocalIsoDate()
): JobTaskListItem[] {
  return [...rows]
    .filter((row) => row.status === "open")
    .sort((a, b) => compareOpenTasks(a, b, today));
}

export function sortCompletedJobTasks(
  rows: readonly JobTaskListItem[]
): JobTaskListItem[] {
  return [...rows]
    .filter((row) => row.status === "complete")
    .sort((a, b) => {
      const byCompleted = String(b.completedAt ?? "").localeCompare(
        String(a.completedAt ?? "")
      );
      if (byCompleted !== 0) return byCompleted;
      return a.id.localeCompare(b.id);
    });
}

export type JobTaskWorkspaceView = {
  openTasks: JobTaskListItem[];
  completedTasks: JobTaskListItem[];
  isEmpty: boolean;
  completedCount: number;
};

export function buildJobTaskWorkspaceView(input: {
  tasks: readonly JobTaskListItem[];
  today?: string;
}): JobTaskWorkspaceView {
  const today = input.today ?? todayLocalIsoDate();
  const openTasks = sortOpenJobTasks(input.tasks, today);
  const completedTasks = sortCompletedJobTasks(input.tasks);
  return {
    openTasks,
    completedTasks,
    isEmpty: openTasks.length === 0 && completedTasks.length === 0,
    completedCount: completedTasks.length,
  };
}
