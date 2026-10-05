/**
 * Job Card Overview presentation (pure): the state hero's tone and icon, its
 * dated timeline, and the collapsed Recent activity summary. Every line comes
 * from existing truth — the stage situation, the active schedule's dates, the
 * actual production start, lifecycle eligibility, and the Activity chronology.
 * Nothing here invents a milestone, a readiness score, or a recommendation.
 */

import type { JobCardOverviewSituationKind } from "@/app/lib/jobCardOverviewSituation";

export type JobCardOverviewHeroTone = "active" | "hold" | "quiet";
export type JobCardOverviewHeroIcon =
  | "calendar"
  | "work"
  | "approved"
  | "accepted"
  | "proposal"
  | "intake"
  | "measurement"
  | "hold"
  | "closed"
  | "complete"
  | "unknown";

export function jobCardOverviewHeroLook(kind: JobCardOverviewSituationKind): {
  tone: JobCardOverviewHeroTone;
  icon: JobCardOverviewHeroIcon;
} {
  switch (kind) {
    case "scheduled":
      return { tone: "active", icon: "calendar" };
    case "production":
      return { tone: "active", icon: "work" };
    case "approved":
      return { tone: "active", icon: "approved" };
    case "accepted_awaiting_approval":
      return { tone: "quiet", icon: "accepted" };
    case "proposal_draft":
    case "proposal_sent":
    case "proposal_none":
      return { tone: "quiet", icon: "proposal" };
    case "intake":
      return { tone: "quiet", icon: "intake" };
    case "on_hold":
      return { tone: "hold", icon: "hold" };
    case "lost":
    case "closed":
    case "closed_during_production":
      return { tone: "quiet", icon: "closed" };
    case "complete_balance":
    case "complete_settled":
    case "complete_money_unknown":
      return { tone: "quiet", icon: "complete" };
    default:
      return { tone: "quiet", icon: "unknown" };
  }
}

export type JobCardOverviewTimelineEntry = {
  key: "today" | "planned_start" | "planned_finish" | "started";
  /** "Today" or a short date ("Oct 2"). */
  dateLabel: string;
  label: string;
  current: boolean;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function dateOnly(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return DATE_ONLY.test(trimmed) ? trimmed : null;
}

/** "2026-10-02" → "Oct 2". Calendar dates have no timezone of their own. */
export function formatTimelineDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

/** The calendar date of an instant in the company's timezone ("YYYY-MM-DD"). */
export function calendarDateInTimeZone(instant: Date | string, timeZone: string | null | undefined): string | null {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return null;
  const format = (zone?: string) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(zone ? { timeZone: zone } : {}),
    }).format(date);
  try {
    return format(timeZone ?? undefined);
  } catch {
    return format();
  }
}

export type JobCardOverviewTimelineInput = {
  kind: JobCardOverviewSituationKind;
  /** Active schedule calendar dates. */
  startsOn: string | null;
  endsOn: string | null;
  /** Today's calendar date in the company timezone. */
  today: string | null;
  /** Actual production start, as a calendar date in the company timezone. */
  startedOn: string | null;
  /** The Overview's primary lifecycle action, when the viewer may take it. */
  primaryKind: string | null;
};

/**
 * Scheduled and in-production jobs only, and only from real dates. "Today"
 * carries a label only when lifecycle truth gives it one.
 */
export function buildJobCardOverviewTimeline(
  input: JobCardOverviewTimelineInput
): JobCardOverviewTimelineEntry[] {
  if (input.kind !== "scheduled" && input.kind !== "production") return [];
  const startsOn = dateOnly(input.startsOn);
  const endsOn = dateOnly(input.endsOn);
  const today = dateOnly(input.today);
  const startedOn = dateOnly(input.startedOn);

  const dated: Array<{ key: JobCardOverviewTimelineEntry["key"]; date: string; label: string }> = [];
  if (input.kind === "scheduled") {
    if (startsOn) dated.push({ key: "planned_start", date: startsOn, label: "Planned start" });
  } else if (startedOn) {
    dated.push({ key: "started", date: startedOn, label: "Work started" });
  }
  const first = dated[0]?.date ?? (input.kind === "scheduled" ? null : startsOn);
  if (endsOn && endsOn !== first) {
    dated.push({ key: "planned_finish", date: endsOn, label: "Planned finish" });
  }
  if (dated.length === 0) return [];

  const todayLabel =
    input.kind === "production"
      ? "Work in progress"
      : input.primaryKind === "start_work"
        ? "Ready to start work"
        : null;

  const entries: Array<JobCardOverviewTimelineEntry & { date: string }> = dated.map((entry) => ({
    key: entry.key,
    date: entry.date,
    dateLabel: formatTimelineDate(entry.date),
    label: entry.label,
    current: false,
  }));

  if (today) {
    const sameDay = entries.find((entry) => entry.date === today);
    if (sameDay) {
      sameDay.dateLabel = "Today";
      sameDay.current = true;
    } else if (todayLabel) {
      entries.push({ key: "today", date: today, dateLabel: "Today", label: todayLabel, current: true });
    }
  }

  return entries
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key === "today" ? -1 : 1))
    .map(({ key, dateLabel, label, current }) => ({ key, dateLabel, label, current }));
}

export const RECENT_ACTIVITY_LIMIT = 5;

export type RecentActivityStatus = "loading" | "ready" | "error";

/** Latest events, newest first; loading and failure are never "no activity". */
export function recentActivitySummary<T>(
  items: readonly T[],
  status: RecentActivityStatus
): { countLabel: string; items: T[] } {
  if (status === "loading") return { countLabel: "Checking activity…", items: [] };
  if (status === "error") return { countLabel: "Activity couldn't be loaded", items: [] };
  const recent = items.slice(0, RECENT_ACTIVITY_LIMIT);
  if (recent.length === 0) return { countLabel: "No activity yet", items: [] };
  return {
    countLabel: recent.length === 1 ? "1 recent event" : `${recent.length} recent events`,
    items: recent,
  };
}
