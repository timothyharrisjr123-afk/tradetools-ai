/**
 * Job Card Crew presentation. Pure: turns the Job → Crew read model, the job's
 * disposition, and the viewer's authority into the Crew fact, the sheet's history,
 * and error copy. The Crew is who is doing the work; it is never the Coordinator,
 * attendance, or software access, and the legacy crew_label is only ever quoted.
 */

import {
  primaryActiveAssignment,
  type JobCrewAssignment,
  type JobCrewAssignments,
} from "@/app/lib/jobCrewAssignmentModel";

export type JobCrewReadStatus = "loading" | "ready" | "error";

const isStr = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isStrOrNull = (value: unknown) => value === null || isStr(value);

function readAssignment(raw: unknown): JobCrewAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (
    !isStr(row.id) || !isStr(row.crewId) || typeof row.isPrimary !== "boolean" ||
    typeof row.active !== "boolean" || !isStr(row.startedAt) || !isStrOrNull(row.endedAt) ||
    !isStrOrNull(row.endReason) || !isStr(row.crewNameSnapshot) || !isStr(row.crewCurrentName) ||
    typeof row.crewArchived !== "boolean" || !isStrOrNull(row.assignmentLeadPersonId) ||
    !isStrOrNull(row.assignmentLeadNameSnapshot) || !Array.isArray(row.roster) ||
    typeof row.rosterListedCount !== "number" || row.active !== (row.endedAt === null)
  ) {
    return null;
  }
  return row as unknown as JobCrewAssignment;
}

/** Strict read of the route's `crewAssignments`. Malformed is null, never an empty history. */
export function readJobCrewAssignments(value: unknown): JobCrewAssignments | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!isStr(body.jobId) || !isStrOrNull(body.primaryActiveAssignmentId) || !Array.isArray(body.assignments)) {
    return null;
  }
  const assignments = body.assignments.map(readAssignment);
  if (assignments.some((entry) => entry === null)) return null;
  const list = assignments as JobCrewAssignment[];
  const primary = body.primaryActiveAssignmentId as string | null;
  if (primary !== null && !list.some((entry) => entry.id === primary && entry.active)) return null;
  return { jobId: body.jobId, primaryActiveAssignmentId: primary, assignments: list };
}

export type JobCrewFactAction = "assign" | "change" | "remove" | "retry";

export type JobCrewFactView = {
  label: "Crew" | "Last crew";
  text: string;
  quiet: boolean;
  /** The person leading the Crew on this job, as a plain name; never a title like "· Lead". */
  leadName: string | null;
  /** `Earlier crew note: "…"` — only while no durable Crew is on the job. */
  legacyNote: string | null;
  /** Why the crew can't change right now (on hold / lost). */
  dispositionNote: string | null;
  action: JobCrewFactAction | null;
  actionLabel: string | null;
  current: JobCrewAssignment | null;
};

export type JobCrewFactInput = {
  status: JobCrewReadStatus;
  model: JobCrewAssignments | null;
  /** jobs.status: active | on_hold | lost | closed. */
  jobStatus: string | null | undefined;
  legacyCrewLabel: string | null | undefined;
  canAssign: boolean;
};

export type JobCrewDisposition = "active" | "on_hold" | "lost" | "closed";

export function jobCrewDisposition(jobStatus: string | null | undefined): JobCrewDisposition {
  return jobStatus === "on_hold" || jobStatus === "lost" || jobStatus === "closed" ? jobStatus : "active";
}

function personName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

/** Relationship wording for the Crew sheet: "Led by Tim Harris". */
export function ledByLine(name: string | null | undefined): string | null {
  const trimmed = personName(name);
  return trimmed ? `Led by ${trimmed}` : null;
}

export function legacyCrewNote(label: string | null | undefined): string | null {
  const trimmed = label?.trim();
  return trimmed ? `Earlier crew note: "${trimmed}"` : null;
}

/** Picker-only size of a Crew's current roster. Never shown on the Job Card fact. */
export function crewPeopleLabel(count: number): string {
  if (count <= 0) return "Members not listed";
  return count === 1 ? "1 person" : `${count} people`;
}

/** Recorded plan at assignment time, never participation. */
export function listedAtAssignmentLabel(count: number): string {
  if (count <= 0) return "Members not listed";
  return `Listed at assignment: ${count === 1 ? "1 person" : `${count} people`}`;
}

export function dispositionChangeNote(disposition: JobCrewDisposition, hasCrew: boolean): string | null {
  if (disposition === "on_hold") {
    return hasCrew ? "Resume this job to change its crew." : "Resume this job to assign a crew.";
  }
  if (disposition === "lost") {
    return hasCrew ? "Reopen this job to change its crew." : "Reopen this job to assign a crew.";
  }
  return null;
}

/** A Crew's continuous time on the job; Lead changes keep the same stint. */
export type JobCrewStint = {
  key: string;
  crewId: string;
  crewName: string;
  startedAt: string;
  endedAt: string | null;
  leadName: string | null;
  rosterListedCount: number;
  active: boolean;
};

function byStart(a: JobCrewAssignment, b: JobCrewAssignment) {
  return a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0;
}

export function jobCrewStints(model: JobCrewAssignments | null): JobCrewStint[] {
  if (!model) return [];
  const stints: JobCrewStint[] = [];
  let previous: JobCrewAssignment | null = null;
  for (const row of [...model.assignments].sort(byStart)) {
    const last = stints[stints.length - 1];
    const continues =
      last && previous && previous.endReason === "lead_changed" && previous.crewId === row.crewId;
    if (continues) {
      last.key = row.id;
      last.endedAt = row.endedAt;
      last.leadName = row.assignmentLeadNameSnapshot;
      last.rosterListedCount = row.rosterListedCount;
      last.active = row.active;
      last.crewName = row.crewNameSnapshot;
    } else {
      stints.push({
        key: row.id,
        crewId: row.crewId,
        crewName: row.crewNameSnapshot,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        leadName: row.assignmentLeadNameSnapshot,
        rosterListedCount: row.rosterListedCount,
        active: row.active,
      });
    }
    previous = row;
  }
  return stints;
}

export const EARLIER_CREW_LIMIT = 3;

/** Ended stints, newest first. The sheet shows at most EARLIER_CREW_LIMIT. */
export function earlierCrewStints(model: JobCrewAssignments | null): JobCrewStint[] {
  return jobCrewStints(model)
    .filter((stint) => !stint.active)
    .reverse();
}

function formatDay(iso: string, timeZone: string | null | undefined): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  }
}

export function stintDateRange(stint: JobCrewStint, timeZone?: string | null): string {
  const start = formatDay(stint.startedAt, timeZone);
  const end = stint.endedAt ? formatDay(stint.endedAt, timeZone) : null;
  if (!end || end === start) return start;
  return `${start} – ${end}`;
}

export function buildJobCrewFactView(input: JobCrewFactInput): JobCrewFactView {
  const disposition = jobCrewDisposition(input.jobStatus);
  const base = {
    leadName: null,
    legacyNote: null,
    dispositionNote: null,
    action: null,
    actionLabel: null,
    current: null,
  } satisfies Partial<JobCrewFactView>;

  if (input.status === "loading" || (input.status === "ready" && !input.model)) {
    return { ...base, label: "Crew", text: "Checking crew…", quiet: true };
  }
  if (input.status === "error" || !input.model) {
    return {
      ...base,
      label: "Crew",
      text: "Crew couldn't be loaded",
      quiet: true,
      action: "retry",
      actionLabel: "Try again",
    };
  }

  const current = primaryActiveAssignment(input.model);
  if (current && disposition !== "closed") {
    const blocked = disposition === "on_hold" || disposition === "lost";
    return {
      ...base,
      label: "Crew",
      text: current.crewCurrentName,
      quiet: false,
      leadName: personName(current.assignmentLeadNameSnapshot),
      current,
      dispositionNote: input.canAssign ? dispositionChangeNote(disposition, true) : null,
      action: input.canAssign ? (blocked ? "remove" : "change") : null,
      actionLabel: input.canAssign ? (blocked ? "Remove crew" : "Change") : null,
    };
  }

  if (disposition === "closed") {
    const last = jobCrewStints(input.model).reverse()[0] ?? null;
    if (last) {
      return {
        ...base,
        label: "Last crew",
        text: last.crewName,
        quiet: false,
        leadName: personName(last.leadName),
      };
    }
    return { ...base, label: "Crew", text: "No crew assigned", quiet: true };
  }

  const canAssignNow = input.canAssign && disposition === "active";
  return {
    ...base,
    label: "Crew",
    text: "No crew assigned",
    quiet: true,
    legacyNote: legacyCrewNote(input.legacyCrewLabel),
    dispositionNote: input.canAssign ? dispositionChangeNote(disposition, false) : null,
    action: canAssignNow ? "assign" : null,
    actionLabel: canAssignNow ? "Assign crew" : null,
  };
}

/** Maps a route/RPC code to contractor copy. Raw codes are never rendered. */
export function jobCrewErrorMessage(code: string | null | undefined, jobStatus: string | null | undefined): string {
  switch (code) {
    case "stale_assignment":
      return "The crew on this job just changed. Here's the latest.";
    case "disposition_blocks_assignment": {
      const disposition = jobCrewDisposition(jobStatus);
      if (disposition === "lost") return "This job is marked lost. Reopen it to change its crew.";
      if (disposition === "closed") return "This job is closed.";
      return "This job is on hold. Resume it to change its crew.";
    }
    case "crew_not_eligible":
      return "That crew is no longer available. Pick another.";
    case "lead_not_eligible":
      return "That person can't lead this crew right now. Pick someone else.";
    case "capability_denied":
    case "forbidden":
    case "invalid_role":
      return "You don't have access to change the crew on this job.";
    case "not_found":
      return "This job is no longer available. Refresh and try again.";
    default:
      return "Couldn't save. Try again.";
  }
}

/** Only transport failures and unavailability keep the same request id for a retry. */
export function isRetryableCrewFailure(code: string | null | undefined): boolean {
  return (
    !code ||
    code === "network" ||
    code === "crew_assignment_unavailable" ||
    code === "authorization_unavailable" ||
    code === "internal_error"
  );
}
