/**
 * Job → Crew assignment read model.
 *
 * An active assignment (no end) means the Crew is currently assigned/responsible for
 * the Job. It is not attendance, hours, a schedule, the current Crew roster, the
 * Coordinator, or software access. A Job may hold several assignments over time and,
 * later, several at once; the first release marks one primary active assignment.
 */

import { isUuidLike } from "@/app/lib/uuid";

export const GET_JOB_CREW_ASSIGNMENTS_RPC_V1 = "get_job_crew_assignments_v1";
export const SET_PRIMARY_JOB_CREW_RPC_V1 = "set_primary_job_crew_v1";
export const END_JOB_CREW_ASSIGNMENT_RPC_V1 = "end_job_crew_assignment_v1";

export const JOB_CREW_END_REASONS = ["replaced", "lead_changed", "ended", "job_lost", "job_completed", "job_closed"] as const;
export type JobCrewEndReason = (typeof JOB_CREW_END_REASONS)[number];

/** Ended by the Job's own lifecycle (Lost / Complete / Closed), never by a person's choice. */
export const JOB_CREW_LIFECYCLE_END_REASONS = ["job_lost", "job_completed", "job_closed"] as const satisfies readonly JobCrewEndReason[];

export type JobCrewRosterEntry = {
  personId: string;
  displayName: string;
};

export type JobCrewAssignment = {
  id: string;
  crewId: string;
  isPrimary: boolean;
  active: boolean;
  startedAt: string;
  endedAt: string | null;
  endReason: JobCrewEndReason | null;
  supersedesAssignmentId: string | null;
  crewNameSnapshot: string;
  crewCurrentName: string;
  crewArchived: boolean;
  assignmentLeadPersonId: string | null;
  assignmentLeadNameSnapshot: string | null;
  /** The Lead's live Person name; null when there is no Lead. History reads the snapshot. */
  assignmentLeadCurrentName: string | null;
  assignmentLeadArchived: boolean | null;
  roster: JobCrewRosterEntry[];
  rosterListedCount: number;
};

export type JobCrewAssignments = {
  jobId: string;
  primaryActiveAssignmentId: string | null;
  assignments: JobCrewAssignment[];
};

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const id = (value: unknown): string | null => (typeof value === "string" && isUuidLike(value) ? value : null);
const optionalId = (value: unknown): string | null | undefined =>
  value == null ? null : id(value) ?? undefined;
const bool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

function parseEndReason(value: unknown): JobCrewEndReason | null | undefined {
  if (value == null) return null;
  return (JOB_CREW_END_REASONS as readonly unknown[]).includes(value) ? (value as JobCrewEndReason) : undefined;
}

function parseRosterEntry(raw: unknown): JobCrewRosterEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const personId = id(row.person_id);
  const displayName = str(row.display_name_snapshot);
  return personId && displayName ? { personId, displayName } : null;
}

function parseAssignment(raw: unknown): JobCrewAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const assignmentId = id(row.id);
  const crewId = id(row.crew_id);
  const isPrimary = bool(row.is_primary);
  const startedAt = str(row.started_at);
  const endedAt = row.ended_at == null ? null : str(row.ended_at);
  const endReason = parseEndReason(row.end_reason);
  const supersedes = optionalId(row.supersedes_assignment_id);
  const crewNameSnapshot = str(row.crew_name_snapshot);
  const crewCurrentName = str(row.crew_current_name);
  const crewArchived = bool(row.crew_archived);
  const leadId = optionalId(row.assignment_lead_person_id);
  const leadName = row.assignment_lead_name_snapshot == null ? null : str(row.assignment_lead_name_snapshot);
  const leadArchived = row.assignment_lead_archived == null ? null : bool(row.assignment_lead_archived);
  const leadCurrentName = leadId === null || row.assignment_lead_current_name == null ? null : str(row.assignment_lead_current_name);
  const count = row.roster_listed_count;
  if (
    !assignmentId || !crewId || isPrimary === null || !startedAt || endedAt === undefined ||
    endReason === undefined || supersedes === undefined || !crewNameSnapshot || !crewCurrentName ||
    crewArchived === null || leadId === undefined || (leadId === null) !== (leadName === null) ||
    (endedAt === null) !== (endReason === null) || !Array.isArray(row.roster) ||
    typeof count !== "number" || !Number.isInteger(count) || count < 0
  ) {
    return null;
  }
  const roster = row.roster.map(parseRosterEntry);
  if (roster.some((entry) => entry === null) || roster.length !== count) return null;
  return {
    id: assignmentId,
    crewId,
    isPrimary,
    active: endedAt === null,
    startedAt,
    endedAt,
    endReason,
    supersedesAssignmentId: supersedes,
    crewNameSnapshot,
    crewCurrentName,
    crewArchived,
    assignmentLeadPersonId: leadId,
    assignmentLeadNameSnapshot: leadName,
    assignmentLeadCurrentName: leadCurrentName,
    assignmentLeadArchived: leadId === null ? null : leadArchived,
    roster: roster as JobCrewRosterEntry[],
    rosterListedCount: count,
  };
}

/** Strict parse of get_job_crew_assignments_v1. Malformed data is null, never an empty history. */
export function parseJobCrewAssignments(raw: unknown): JobCrewAssignments | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (body.ok !== true) return null;
  const jobId = id(body.job_id);
  const primary = optionalId(body.primary_active_assignment_id);
  if (!jobId || primary === undefined || !Array.isArray(body.assignments)) return null;
  const assignments = body.assignments.map(parseAssignment);
  if (assignments.some((entry) => entry === null)) return null;
  const list = assignments as JobCrewAssignment[];
  if (primary !== null && !list.some((entry) => entry.id === primary && entry.active && entry.isPrimary)) {
    return null;
  }
  return { jobId, primaryActiveAssignmentId: primary, assignments: list };
}

export function primaryActiveAssignment(model: JobCrewAssignments): JobCrewAssignment | null {
  if (!model.primaryActiveAssignmentId) return null;
  return model.assignments.find((entry) => entry.id === model.primaryActiveAssignmentId) ?? null;
}

/** Every currently assigned Crew; readers must not assume there is only one. */
export function activeAssignments(model: JobCrewAssignments): JobCrewAssignment[] {
  return model.assignments.filter((entry) => entry.active);
}

/** Roster wording is a recorded plan, never participation. */
export function rosterLabel(assignment: Pick<JobCrewAssignment, "rosterListedCount">): string {
  return assignment.rosterListedCount === 0 ? "Members not listed" : "Listed at assignment";
}

export function endReasonLabel(reason: JobCrewEndReason | null): string | null {
  switch (reason) {
    case "replaced":
      return "Replaced";
    case "lead_changed":
      return "Changed who's leading the crew";
    case "ended":
      return "Ended";
    case "job_lost":
      return "Job lost";
    case "job_completed":
      return "Work complete";
    case "job_closed":
      return "Job closed";
    default:
      return null;
  }
}
