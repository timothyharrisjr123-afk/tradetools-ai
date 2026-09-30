/**
 * Team Board weekly work: scheduled jobs this week (Calendar truth, job_schedules)
 * joined to each job's coordinator (jobs.assigned_to). This is the Lead's own
 * coordinated work. It is not a crew-to-job assignment; none exists yet, and
 * nothing here infers one.
 */

import { addDaysIso, isCivilDate, startOfWeekMondayIso } from "@/app/lib/jobScheduleMapper";

export type TeamWeekJob = {
  jobId: string;
  customerName: string;
  address: string;
  startsOn: string;
  endsOn: string;
  coordinatorUserId: string | null;
};

export type TeamWeek = {
  /** Monday of the company's current week (civil date). */
  startsOn: string;
  /** The Monday after (exclusive). */
  afterEndOn: string;
  jobs: TeamWeekJob[];
};

/** Monday-start week containing `todayIso`, matching the Calendar week view. */
export function teamWeekRange(todayIso: string): { startsOn: string; afterEndOn: string } {
  const startsOn = startOfWeekMondayIso(todayIso);
  return { startsOn, afterEndOn: addDaysIso(startsOn, 7) };
}

/** Jobs a person coordinates this week, soonest first. Unknown coordinators match no one. */
export function weekJobsFor(week: TeamWeek | null, userId: string | null): TeamWeekJob[] | null {
  if (!week || !userId) return null;
  return week.jobs
    .filter((job) => job.coordinatorUserId === userId)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.customerName.localeCompare(b.customerName));
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Wed, Sep 30" for a civil date; multi-day work shows its first day. */
export function weekDayLabel(civilDate: string): string {
  if (!isCivilDate(civilDate)) return "";
  const [y, m, d] = civilDate.split("-").map(Number);
  return DAY.format(new Date(Date.UTC(y, m - 1, d)));
}

export function weekJobsLabel(count: number): string {
  return count === 1 ? "1 job" : `${count} jobs`;
}

/** The week API payload; rejects anything malformed rather than inventing work. */
export function readTeamWeek(value: unknown): TeamWeek | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<TeamWeek>;
  if (!isCivilDate(raw.startsOn) || !isCivilDate(raw.afterEndOn) || !Array.isArray(raw.jobs)) return null;
  const ok = raw.jobs.every(
    (job) =>
      typeof job?.jobId === "string" &&
      typeof job?.customerName === "string" &&
      typeof job?.address === "string" &&
      isCivilDate(job?.startsOn) &&
      isCivilDate(job?.endsOn) &&
      (job?.coordinatorUserId === null || typeof job?.coordinatorUserId === "string")
  );
  return ok ? (raw as TeamWeek) : null;
}
