/**
 * Job Lifecycle Foundation — canonical stage / disposition contracts.
 *
 * Locked by docs/fielddive-global-handoff.md §6BP.
 * Stored jobs.stage/status may still contain legacy readable values.
 */

export const CANONICAL_JOB_STAGES = [
  "intake",
  "proposal",
  "approved",
  "scheduled",
  "production",
  "complete",
] as const;

export type CanonicalJobStage = (typeof CANONICAL_JOB_STAGES)[number];

export const LEGACY_READABLE_JOB_STAGES = [
  "measurement",
  "estimating",
  "archived",
] as const;

export type LegacyReadableJobStage = (typeof LEGACY_READABLE_JOB_STAGES)[number];

export type StoredJobStage = CanonicalJobStage | LegacyReadableJobStage;

export const OPERATIONAL_JOB_DISPOSITIONS = [
  "active",
  "on_hold",
  "lost",
  "closed",
] as const;

export type OperationalJobDisposition =
  (typeof OPERATIONAL_JOB_DISPOSITIONS)[number];

export const LEGACY_READABLE_JOB_DISPOSITIONS = ["won", "archived"] as const;

export type LegacyReadableJobDisposition =
  (typeof LEGACY_READABLE_JOB_DISPOSITIONS)[number];

export type StoredJobDisposition =
  | OperationalJobDisposition
  | LegacyReadableJobDisposition;

export const JOB_ACTIVITY_EVENT_TYPES = [
  "job_created",
  "stage_changed",
  "disposition_changed",
] as const;

export type JobActivityEventType = (typeof JOB_ACTIVITY_EVENT_TYPES)[number];

/** All current Activity types are system-owned. No authenticated manual types. */
export const SYSTEM_RESERVED_JOB_ACTIVITY_EVENT_TYPES = JOB_ACTIVITY_EVENT_TYPES;

export const AUTHENTICATED_MANUAL_JOB_ACTIVITY_EVENT_TYPES: readonly JobActivityEventType[] =
  [];

export const CANONICAL_JOB_STAGE_LABELS: Record<CanonicalJobStage, string> = {
  intake: "Intake",
  proposal: "Proposal",
  approved: "Approved",
  scheduled: "Scheduled",
  production: "Production",
  complete: "Complete",
};

export const OPERATIONAL_JOB_DISPOSITION_LABELS: Record<
  OperationalJobDisposition,
  string
> = {
  active: "Active",
  on_hold: "On hold",
  lost: "Lost",
  closed: "Closed",
};

/** Conceptual canonical edges. Live DB writes use FOUNDATION_ENABLED_STAGE_EDGES. */
export const CANONICAL_STAGE_EDGES: ReadonlyArray<
  readonly [CanonicalJobStage, CanonicalJobStage]
> = [
  ["intake", "proposal"],
  ["proposal", "approved"],
  ["approved", "scheduled"],
  ["scheduled", "production"],
  ["production", "complete"],
];

/** The only externally callable lifecycle transition before R3C/R3F/production actions. */
export const FOUNDATION_ENABLED_STAGE_EDGES: ReadonlyArray<
  readonly [CanonicalJobStage, CanonicalJobStage]
> = [["intake", "proposal"]];

export const JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED = false;
export const JOB_LIFECYCLE_APPROVED_TRANSITIONS_ENABLED = false;
export const JOB_LIFECYCLE_PRODUCTION_TRANSITIONS_ENABLED = false;
export const JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED = false;

export type JobLifecycleMapperInput = {
  stage: string | null | undefined;
  status?: string | null;
  archived?: boolean | null;
  active_proposal_id?: string | null;
  latest_proposal_id?: string | null;
};

export type JobActivityEvent = {
  id: string;
  company_id: string;
  job_id: string;
  event_type: JobActivityEventType;
  actor_user_id?: string | null;
  payload_json?: Record<string, unknown> | null;
  occurred_at: string;
  created_at?: string;
};
