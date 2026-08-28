/**
 * Contractor-facing Job Activity chronology.
 *
 * Durable truth stays on job_activity_events (and existing proposal facts).
 * This module is read-only presentation: classify, suppress companions,
 * map contractor wording, group by day. It does not write Activity or
 * invent timestamps.
 *
 * Activity tells the job story. It does not expose system churn.
 */

import type { JobCardActivityItem } from "@/app/tools/roofing/jobCard/JobCardActivityPanel";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import type { JobCardProposalSentFactsById } from "@/app/lib/proposalJobCardLifecycleRead";
import type { ProposalAcceptanceActivityItem } from "@/app/lib/proposalAcceptanceActivity";
import type { ProposalSignatureActivityItem } from "@/app/lib/proposalSignatureActivity";
import type { JobPaymentActivityItem } from "@/app/lib/jobPaymentReadModel";
import {
  composeScheduleActivityItem,
  isSuppressedScheduleStageChange,
} from "@/app/lib/jobScheduleActivity";
import {
  composeProductionActivityItem,
  isSuppressedProductionStageChange,
} from "@/app/lib/jobProductionActivity";
import {
  composeCompleteActivityItem,
  isSuppressedCompleteStageChange,
} from "@/app/lib/jobCompleteActivity";
import { composeDispositionChangedActivity } from "@/app/lib/jobDispositionManagement";
import {
  formatScheduleWindowLabel,
  parseScheduleWindowPayload,
} from "@/app/lib/jobScheduleMapper";
import type { JobScheduleWindow } from "@/app/lib/jobScheduleTypes";
import { isUuidLike } from "@/app/lib/uuid";

export const JOB_ACTIVITY_VISIBILITY = {
  CONTRACTOR_VISIBLE: "contractor_visible",
  SYSTEM_INTERNAL: "system_internal",
} as const;

export type JobActivityVisibility =
  (typeof JOB_ACTIVITY_VISIBILITY)[keyof typeof JOB_ACTIVITY_VISIBILITY];

export type JobActivityChronologyKind =
  | "job_created"
  | "proposal_sent"
  | "proposal_accepted"
  | "work_approved"
  | "work_scheduled"
  | "work_rescheduled"
  | "work_unscheduled"
  | "work_started"
  | "work_completed"
  | "job_on_hold"
  | "job_resumed"
  | "job_lost"
  | "job_closed";

export type JobActivityChronologyRow = {
  id: string;
  kind: JobActivityChronologyKind;
  title: string;
  detail: string | null;
  occurredAt: string;
  timeLabel: string;
  dayKey: string;
  dayLabel: string;
  actor: string | null;
  source: "durable" | "derived";
  sourceIds: readonly string[];
};

export type JobActivityChronologyGroup = {
  dayKey: string;
  dayLabel: string;
  rows: JobActivityChronologyRow[];
};

export type ComposeJobActivityInput = {
  jobCreatedAt?: string | null;
  jobActivityEvents?: readonly JobActivityEvent[];
  proposals?: readonly ProposalRecordStatusSummary[];
  sentFactsByProposalId?: JobCardProposalSentFactsById;
  customerRequestItems?: readonly JobCardActivityItem[];
  acceptanceItems?: readonly ProposalAcceptanceActivityItem[];
  signatureItems?: readonly ProposalSignatureActivityItem[];
  paymentItems?: readonly JobPaymentActivityItem[];
};

const FORBIDDEN_ACTIVITY_LABEL =
  /\b(Job card opened|Estimate loaded|autosave|previewed|snapshot_frozen|Builder opened|Preview opened|Acceptance confirmed)\b/i;

const SUPPRESSED_STAGE_REASONS = new Set([
  "scheduled_job",
  "unscheduled_job",
  "work_started",
  "work_completed",
  "first_proposal_created",
]);

const DISPOSITION_KIND_BY_LABEL: Record<string, JobActivityChronologyKind> = {
  "Job put on hold": "job_on_hold",
  "Job reactivated": "job_resumed",
  "Job marked lost": "job_lost",
  "Job closed": "job_closed",
};

export const JOB_ACTIVITY_FORBIDDEN_EVENT_TYPES = [
  "draft_saved",
  "previewed",
  "snapshot_frozen",
] as const;

function parseTs(iso: string | null | undefined): number {
  const ts = Date.parse(String(iso ?? ""));
  return Number.isFinite(ts) ? ts : 0;
}

function payloadString(
  payload: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const value = payload?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function windowTimezone(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const timezone = (raw as { timezone?: unknown }).timezone;
  return typeof timezone === "string" && timezone.trim() ? timezone.trim() : null;
}

export function resolveActivityEventTimezone(
  event: Pick<JobActivityEvent, "payload_json">
): string | null {
  const payload = event.payload_json ?? {};
  return (
    windowTimezone(payload.planned_window) ??
    windowTimezone(payload.window) ??
    windowTimezone(payload.previous_window) ??
    (typeof payload.timezone === "string" ? payload.timezone.trim() || null : null)
  );
}

function formatWithZone(
  iso: string,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  const opts: Intl.DateTimeFormatOptions = { ...options };
  if (timeZone?.trim()) opts.timeZone = timeZone.trim();
  try {
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(parsed));
  } catch {
    delete opts.timeZone;
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(parsed));
  }
}

export function formatActivityDayLabel(
  iso: string,
  timeZone?: string | null
): string {
  return (
    formatWithZone(iso, timeZone, { month: "short", day: "numeric" }) ?? ""
  );
}

export function formatActivityTimeLabel(
  iso: string,
  timeZone?: string | null
): string {
  return (
    formatWithZone(iso, timeZone, {
      hour: "numeric",
      minute: "2-digit",
    }) ?? ""
  );
}

export function formatActivityDayKey(
  iso: string,
  timeZone?: string | null
): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "";
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  if (timeZone?.trim()) opts.timeZone = timeZone.trim();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", opts).formatToParts(
      new Date(parsed)
    );
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    /* fall through */
  }
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(parsed));
  } catch {
    return "";
  }
}

const ACTOR_NAME_KEYS = [
  "actor_name",
  "actor_display_name",
  "performed_by_name",
  "actor_full_name",
] as const;

export function resolveActivityActorDisplay(
  payload: Record<string, unknown> | null | undefined,
  actorUserId?: string | null
): string | null {
  void actorUserId;
  for (const key of ACTOR_NAME_KEYS) {
    const value = payloadString(payload, key);
    if (!value) continue;
    if (isUuidLike(value)) continue;
    if (/^unknown(\s+user)?$/i.test(value)) continue;
    return value;
  }
  return null;
}

function isTechnicalNote(value: string, title: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed === title) return true;
  if (isUuidLike(trimmed)) return true;
  if (/^unknown(\s+user)?$/i.test(trimmed)) return true;
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(trimmed)) return true;
  if (/disposition returned to active/i.test(trimmed)) return true;
  if (/^customer accepted this proposal$/i.test(trimmed)) return true;
  if (/^production started$/i.test(trimmed)) return true;
  if (/^job completed$/i.test(trimmed)) return true;
  return false;
}

function scheduleDetailFromPayload(raw: unknown): string | null {
  const window =
    parseScheduleWindowPayload(raw) ??
    (raw && typeof raw === "object"
      ? parseScheduleWindowPayload(raw)
      : null);
  return window ? formatScheduleWindowLabel(window) : null;
}

const SCHEDULE_ACTIVITY_EVENT_TYPES = new Set<
  JobActivityEvent["event_type"]
>(["job_scheduled", "job_rescheduled", "job_unscheduled"]);

function scheduleWindowFromEventPayload(
  payload: Record<string, unknown> | null | undefined,
  key: "window" | "previous_window"
): JobScheduleWindow | null {
  return parseScheduleWindowPayload(payload?.[key]);
}

function scheduleWindowsEqual(
  a: JobScheduleWindow | null,
  b: JobScheduleWindow | null
): boolean {
  if (!a || !b) return false;
  return (
    a.all_day === b.all_day &&
    a.starts_on === b.starts_on &&
    a.ends_on === b.ends_on &&
    (a.start_local_time ?? null) === (b.start_local_time ?? null) &&
    (a.end_local_time ?? null) === (b.end_local_time ?? null) &&
    a.timezone === b.timezone &&
    (a.notes ?? null) === (b.notes ?? null)
  );
}

function isScheduleUndoPair(a: JobActivityEvent, b: JobActivityEvent): boolean {
  const aPrev = scheduleWindowFromEventPayload(a.payload_json, "previous_window");
  const aWin = scheduleWindowFromEventPayload(a.payload_json, "window");
  const bPrev = scheduleWindowFromEventPayload(b.payload_json, "previous_window");
  const bWin = scheduleWindowFromEventPayload(b.payload_json, "window");
  return (
    scheduleWindowsEqual(bWin, aPrev) && scheduleWindowsEqual(bPrev, aWin)
  );
}

function isScheduleReapplyAfterUndo(
  first: JobActivityEvent,
  undo: JobActivityEvent,
  reapply: JobActivityEvent
): boolean {
  const firstWin = scheduleWindowFromEventPayload(first.payload_json, "window");
  const undoWin = scheduleWindowFromEventPayload(undo.payload_json, "window");
  const reapplyWin = scheduleWindowFromEventPayload(reapply.payload_json, "window");
  const reapplyPrev = scheduleWindowFromEventPayload(
    reapply.payload_json,
    "previous_window"
  );
  return (
    scheduleWindowsEqual(reapplyWin, firstWin) &&
    scheduleWindowsEqual(reapplyPrev, undoWin)
  );
}

/**
 * Hide superseded intermediate reschedules within one contiguous run.
 * Uses durable window previous/new chains — not timestamp proximity.
 */
function collapseSupersededRescheduleRun(
  run: readonly JobActivityEvent[],
  anchorWindow: JobScheduleWindow | null
): JobActivityEvent[] {
  if (run.length <= 1) return [...run];

  const hidden = new Set<number>();
  let i = 0;
  while (i < run.length) {
    if (hidden.has(i)) {
      i++;
      continue;
    }
    const current = run[i]!;
    const next = run[i + 1];
    const afterUndo = run[i + 2];
    if (next && isScheduleUndoPair(current, next)) {
      if (afterUndo && isScheduleReapplyAfterUndo(current, next, afterUndo)) {
        hidden.add(i);
        hidden.add(i + 1);
        i += 2;
        continue;
      }
      const nextWindow = scheduleWindowFromEventPayload(next.payload_json, "window");
      if (anchorWindow && scheduleWindowsEqual(nextWindow, anchorWindow)) {
        i += 2;
        continue;
      }
      hidden.add(i);
      i += 2;
      continue;
    }
    i++;
  }
  return run.filter((_, index) => !hidden.has(index));
}

function scheduleEventOrder(a: JobActivityEvent, b: JobActivityEvent): number {
  const delta = parseTs(a.occurred_at) - parseTs(b.occurred_at);
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}

/**
 * Collapse contiguous job_rescheduled rows on the same schedule identity.
 * Durable RPC mutates one active schedule row; ping-pong intermediate windows
 * remain in audit truth but only the final effective reschedule in each run
 * is contractor-visible.
 */
export function collapseContiguousScheduleReschedules(
  events: readonly JobActivityEvent[]
): JobActivityEvent[] {
  const scheduleEvents = events
    .filter((event) => SCHEDULE_ACTIVITY_EVENT_TYPES.has(event.event_type))
    .sort(scheduleEventOrder);

  const visible: JobActivityEvent[] = [];
  let rescheduleRun: JobActivityEvent[] = [];
  let anchorWindow: JobScheduleWindow | null = null;

  const scheduleIdFor = (event: JobActivityEvent): string | null =>
    payloadString(event.payload_json ?? {}, "schedule_id");

  const flushRescheduleRun = () => {
    if (rescheduleRun.length === 0) return;
    visible.push(...collapseSupersededRescheduleRun(rescheduleRun, anchorWindow));
    rescheduleRun = [];
  };

  for (const event of scheduleEvents) {
    if (event.event_type === "job_scheduled") {
      flushRescheduleRun();
      anchorWindow = scheduleWindowFromEventPayload(event.payload_json, "window");
      visible.push(event);
      continue;
    }
    if (event.event_type === "job_unscheduled") {
      flushRescheduleRun();
      anchorWindow = null;
      visible.push(event);
      continue;
    }
    const scheduleId = scheduleIdFor(event);
    if (rescheduleRun.length > 0 && scheduleId) {
      const runScheduleId = scheduleIdFor(rescheduleRun[0]!);
      if (runScheduleId && runScheduleId !== scheduleId) {
        flushRescheduleRun();
      }
    }
    rescheduleRun.push(event);
  }
  flushRescheduleRun();
  return visible;
}

export function classifyJobActivityEvent(
  event: JobActivityEvent
): JobActivityVisibility {
  if (event.event_type === "stage_changed") {
    if (
      isSuppressedScheduleStageChange(event) ||
      isSuppressedProductionStageChange(event) ||
      isSuppressedCompleteStageChange(event)
    ) {
      return JOB_ACTIVITY_VISIBILITY.SYSTEM_INTERNAL;
    }
    const reason = payloadString(event.payload_json, "reason");
    if (reason && SUPPRESSED_STAGE_REASONS.has(reason)) {
      return JOB_ACTIVITY_VISIBILITY.SYSTEM_INTERNAL;
    }
    if (reason === "contractor_approved") {
      return JOB_ACTIVITY_VISIBILITY.CONTRACTOR_VISIBLE;
    }
    return JOB_ACTIVITY_VISIBILITY.SYSTEM_INTERNAL;
  }
  if (
    event.event_type === "job_created" ||
    event.event_type === "job_scheduled" ||
    event.event_type === "job_rescheduled" ||
    event.event_type === "job_unscheduled" ||
    event.event_type === "job_work_started" ||
    event.event_type === "job_work_completed" ||
    event.event_type === "disposition_changed"
  ) {
    return JOB_ACTIVITY_VISIBILITY.CONTRACTOR_VISIBLE;
  }
  return JOB_ACTIVITY_VISIBILITY.SYSTEM_INTERNAL;
}

function isForbiddenItem(item: { label: string; note?: string }): boolean {
  return (
    FORBIDDEN_ACTIVITY_LABEL.test(item.label) ||
    FORBIDDEN_ACTIVITY_LABEL.test(item.note ?? "")
  );
}

function toItemWhen(row: JobActivityChronologyRow): string | undefined {
  if (row.dayLabel && row.timeLabel) return `${row.dayLabel} · ${row.timeLabel}`;
  return row.dayLabel || row.timeLabel || undefined;
}

export function chronologyRowToActivityItem(
  row: JobActivityChronologyRow
): JobCardActivityItem {
  return {
    label: row.title,
    note: row.detail ?? "",
    when: toItemWhen(row),
    dayKey: row.dayKey,
    dayLabel: row.dayLabel,
    timeLabel: row.timeLabel,
    actor: row.actor,
    kind: row.kind,
  };
}

export function groupJobActivityChronology(
  rows: readonly JobActivityChronologyRow[]
): JobActivityChronologyGroup[] {
  const groups: JobActivityChronologyGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === row.dayKey) {
      last.rows.push(row);
      continue;
    }
    groups.push({
      dayKey: row.dayKey,
      dayLabel: row.dayLabel,
      rows: [row],
    });
  }
  return groups;
}

function sortRows(rows: JobActivityChronologyRow[]): JobActivityChronologyRow[] {
  return [...rows].sort((a, b) => {
    const delta = parseTs(b.occurredAt) - parseTs(a.occurredAt);
    if (delta !== 0) return delta;
    return b.id.localeCompare(a.id);
  });
}

function pushRow(
  rows: JobActivityChronologyRow[],
  seen: Set<string>,
  row: Omit<JobActivityChronologyRow, "dayKey" | "dayLabel" | "timeLabel"> & {
    dayKey?: string;
    dayLabel?: string;
    timeLabel?: string;
    timezone?: string | null;
  }
): void {
  if (isForbiddenItem({ label: row.title, note: row.detail ?? "" })) return;
  const identity = row.sourceIds[0] ? `id:${row.sourceIds[0]}` : row.id;
  if (seen.has(identity)) return;
  seen.add(identity);
  const timezone = row.timezone ?? null;
  rows.push({
    id: row.id,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    occurredAt: row.occurredAt,
    actor: row.actor,
    source: row.source,
    sourceIds: row.sourceIds,
    dayKey: row.dayKey || formatActivityDayKey(row.occurredAt, timezone),
    dayLabel: row.dayLabel || formatActivityDayLabel(row.occurredAt, timezone),
    timeLabel:
      row.timeLabel || formatActivityTimeLabel(row.occurredAt, timezone),
  });
}

function composeEventRow(
  event: JobActivityEvent
): Omit<JobActivityChronologyRow, "dayKey" | "dayLabel" | "timeLabel"> | null {
  if (classifyJobActivityEvent(event) !== JOB_ACTIVITY_VISIBILITY.CONTRACTOR_VISIBLE) {
    return null;
  }
  const payload = event.payload_json ?? {};
  const actor = resolveActivityActorDisplay(payload, event.actor_user_id);

  if (event.event_type === "job_created") {
    return {
      id: event.id,
      kind: "job_created",
      title: "Job created",
      detail: null,
      occurredAt: event.occurred_at,
      actor,
      source: "durable",
      sourceIds: [event.id],
    };
  }

  if (event.event_type === "stage_changed") {
    return {
      id: event.id,
      kind: "work_approved",
      title: "Work approved",
      detail: null,
      occurredAt: event.occurred_at,
      actor,
      source: "durable",
      sourceIds: [event.id],
    };
  }

  const scheduleItem = composeScheduleActivityItem(event);
  if (scheduleItem) {
    const kind: JobActivityChronologyKind =
      event.event_type === "job_rescheduled"
        ? "work_rescheduled"
        : event.event_type === "job_unscheduled"
          ? "work_unscheduled"
          : "work_scheduled";
    const note = scheduleItem.note.trim();
    return {
      id: event.id,
      kind,
      title: scheduleItem.label,
      detail: note && !isTechnicalNote(note, scheduleItem.label) ? note : null,
      occurredAt: event.occurred_at,
      actor,
      source: "durable",
      sourceIds: [event.id],
    };
  }

  const productionItem = composeProductionActivityItem(event);
  if (productionItem) {
    const planned =
      scheduleDetailFromPayload(payload.planned_window) ??
      scheduleDetailFromPayload(payload.window);
    return {
      id: event.id,
      kind: "work_started",
      title: "Work started",
      detail: planned,
      occurredAt:
        typeof payload.production_started_at === "string" &&
        parseTs(payload.production_started_at)
          ? payload.production_started_at
          : event.occurred_at,
      actor,
      source: "durable",
      sourceIds: [event.id],
    };
  }

  const completeItem = composeCompleteActivityItem(event);
  if (completeItem) {
    return {
      id: event.id,
      kind: "work_completed",
      title: "Work completed",
      detail: null,
      occurredAt:
        typeof payload.completed_at === "string" && parseTs(payload.completed_at)
          ? payload.completed_at
          : event.occurred_at,
      actor,
      source: "durable",
      sourceIds: [event.id],
    };
  }

  if (event.event_type === "disposition_changed") {
    const composed = composeDispositionChangedActivity(payload);
    if (!composed) return null;
    const kind = DISPOSITION_KIND_BY_LABEL[composed.label];
    if (!kind) return null;
    const note = composed.note.trim();
    return {
      id: event.id,
      kind,
      title: composed.label,
      detail: note && !isTechnicalNote(note, composed.label) ? note : null,
      occurredAt: event.occurred_at,
      actor,
      source: "durable",
      sourceIds: [event.id],
    };
  }

  return null;
}

export function composeJobActivityChronology(
  input: ComposeJobActivityInput
): JobActivityChronologyRow[] {
  const rows: JobActivityChronologyRow[] = [];
  const seen = new Set<string>();

  const createdAt = input.jobCreatedAt ?? null;
  const createdFromEvents = (input.jobActivityEvents ?? []).some(
    (event) => event.event_type === "job_created"
  );
  if (createdAt && !createdFromEvents && parseTs(createdAt)) {
    pushRow(rows, seen, {
      id: "derived:job_created",
      kind: "job_created",
      title: "Job created",
      detail: null,
      occurredAt: createdAt,
      actor: null,
      source: "derived",
      sourceIds: ["derived:job_created"],
    });
  }

  const collapsedScheduleEvents = collapseContiguousScheduleReschedules(
    input.jobActivityEvents ?? []
  );
  const collapsedScheduleIds = new Set(
    collapsedScheduleEvents.map((event) => event.id)
  );

  for (const event of input.jobActivityEvents ?? []) {
    if (SCHEDULE_ACTIVITY_EVENT_TYPES.has(event.event_type)) {
      if (!collapsedScheduleIds.has(event.id)) continue;
    }
    const composed = composeEventRow(event);
    if (!composed) continue;
    pushRow(rows, seen, {
      ...composed,
      timezone: resolveActivityEventTimezone(event),
    });
  }

  for (const proposal of input.proposals ?? []) {
    const facts = input.sentFactsByProposalId?.[proposal.id];
    if (!facts?.latestSentFrozenAt) continue;
    const sentCount = facts.history?.length ?? 1;
    const packageLabel =
      facts.history?.[sentCount - 1]?.packageLabel?.trim() || null;
    pushRow(rows, seen, {
      id: `proposal-sent:${proposal.id}:${facts.latestSentFrozenAt}`,
      kind: "proposal_sent",
      title: sentCount > 1 ? "Revision sent" : "Proposal sent",
      detail: packageLabel,
      occurredAt: facts.latestSentFrozenAt,
      actor: null,
      source: "durable",
      sourceIds: [`proposal-sent:${proposal.id}`],
    });
  }

  for (const acceptance of input.acceptanceItems ?? []) {
    if (isForbiddenItem(acceptance)) continue;
    if (acceptance.label !== "Proposal accepted") continue;
    const acceptedAt = (acceptance.acceptedAt ?? "").trim();
    if (!acceptedAt) continue;
    const acceptanceId = (acceptance.acceptanceId ?? "").trim();
    const note = (acceptance.note ?? "").trim();
    pushRow(rows, seen, {
      id: acceptanceId ? `acceptance:${acceptanceId}` : `acceptance:${acceptedAt}`,
      kind: "proposal_accepted",
      title: "Proposal accepted",
      detail: note && !isTechnicalNote(note, "Proposal accepted") ? note : null,
      occurredAt: acceptedAt,
      actor: null,
      source: "durable",
      sourceIds: acceptanceId ? [`acceptance:${acceptanceId}`] : [acceptedAt],
    });
  }

  void input.customerRequestItems;
  void input.signatureItems;
  void input.paymentItems;

  return sortRows(rows);
}

export function composeJobActivityItems(
  input: ComposeJobActivityInput
): JobCardActivityItem[] {
  return composeJobActivityChronology(input).map(chronologyRowToActivityItem);
}
