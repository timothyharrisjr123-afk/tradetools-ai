/**
 * Server-authoritative job task validation.
 * Title required. Optional due date + short notes. No assignment.
 */

import {
  JOB_TASK_NOTES_MAX,
  JOB_TASK_STATUSES,
  JOB_TASK_TITLE_MAX,
  type JobTaskStatus,
} from "@/app/lib/jobTaskTypes";

export type JobTaskValidationError = {
  ok: false;
  code: "invalid_title" | "invalid_notes" | "invalid_due_on" | "invalid_status";
  message: string;
};

export type JobTaskContentOk = {
  ok: true;
  title: string;
  notes: string | null;
  dueOn: string | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseJobTaskDueOn(
  raw: unknown
): { ok: true; dueOn: string | null } | JobTaskValidationError {
  if (raw == null) return { ok: true, dueOn: null };
  if (typeof raw !== "string") {
    return { ok: false, code: "invalid_due_on", message: "Due date is invalid." };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, dueOn: null };
  const match = ISO_DATE.exec(trimmed);
  if (!match) {
    return { ok: false, code: "invalid_due_on", message: "Due date is invalid." };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return { ok: false, code: "invalid_due_on", message: "Due date is invalid." };
  }
  return { ok: true, dueOn: trimmed };
}

export function parseJobTaskStatus(
  raw: unknown
): { ok: true; status: JobTaskStatus } | JobTaskValidationError {
  if (typeof raw !== "string") {
    return { ok: false, code: "invalid_status", message: "Status is invalid." };
  }
  const status = raw.trim();
  if (!(JOB_TASK_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, code: "invalid_status", message: "Status is invalid." };
  }
  return { ok: true, status: status as JobTaskStatus };
}

export function validateJobTaskContent(input: {
  title: unknown;
  notes?: unknown;
  dueOn?: unknown;
}): JobTaskContentOk | JobTaskValidationError {
  const titleRaw = typeof input.title === "string" ? input.title : "";
  const title = titleRaw.trim();
  if (!title) {
    return { ok: false, code: "invalid_title", message: "Title is required." };
  }
  if (title.length > JOB_TASK_TITLE_MAX) {
    return {
      ok: false,
      code: "invalid_title",
      message: `Title must be ${JOB_TASK_TITLE_MAX} characters or less.`,
    };
  }

  let notes: string | null = null;
  if (input.notes != null && input.notes !== "") {
    if (typeof input.notes !== "string") {
      return { ok: false, code: "invalid_notes", message: "Notes are invalid." };
    }
    const trimmedNotes = input.notes.trim();
    if (trimmedNotes.length > JOB_TASK_NOTES_MAX) {
      return {
        ok: false,
        code: "invalid_notes",
        message: `Notes must be ${JOB_TASK_NOTES_MAX} characters or less.`,
      };
    }
    notes = trimmedNotes.length > 0 ? trimmedNotes : null;
  }

  const due = parseJobTaskDueOn(input.dueOn);
  if (!due.ok) return due;

  return { ok: true, title, notes, dueOn: due.dueOn };
}
