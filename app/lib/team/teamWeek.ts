/**
 * Team "This week" per Crew: the Crew's current Jobs (durable Job → Crew assignment)
 * that the Calendar schedules this week (job_schedules). Two truths joined read-only in
 * the database by get_crew_week_v1. The Coordinator (jobs.assigned_to), the usual Lead,
 * and anyone's login play no part.
 */

import { addDaysIso, isCivilDate, startOfWeekMondayIso } from "@/app/lib/jobScheduleMapper";
import { crewWeekJobs, readCrewWeek, type CrewWeek, type CrewWeekItem } from "@/app/lib/crew/currentCrew";

export type TeamWeek = CrewWeek;
export type TeamWeekJob = CrewWeekItem;

/** Monday-start week containing `todayIso`, matching the Calendar week view. */
export function teamWeekRange(todayIso: string): { startsOn: string; afterEndOn: string } {
  const startsOn = startOfWeekMondayIso(todayIso);
  return { startsOn, afterEndOn: addDaysIso(startsOn, 7) };
}

/** A Crew's Jobs this week, soonest first. */
export function weekJobsForCrew(week: TeamWeek, crewId: string): TeamWeekJob[] {
  return crewWeekJobs(week, crewId);
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Wed, Sep 30" for a civil date; multi-day work shows its first day. */
export function weekDayLabel(civilDate: string): string {
  if (!isCivilDate(civilDate)) return "";
  const [y, m, d] = civilDate.split("-").map(Number);
  return DAY.format(new Date(Date.UTC(y, m - 1, d)));
}

/** The week API payload; rejects anything malformed rather than inventing work. */
export function readTeamWeek(value: unknown): TeamWeek | null {
  return readCrewWeek(value);
}
