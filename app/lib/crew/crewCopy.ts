/**
 * Human-facing Crew wording introduced with current-Crew reads (Team "This week",
 * archive blocking). FieldDive owns the relationship semantics; these strings are the
 * only place the words live, so a contractor terminology setting can replace them
 * later without touching authority, lifecycle, or security code.
 */

export const CREW_WEEK_COPY = {
  checking: "Checking this week…",
  unavailable: "This week couldn't be loaded.",
  retry: "Try again",
  none: "No jobs this week",
  viewInCalendar: "View in calendar",
  onHold: "On hold",
  count: (count: number) => `${count} ${count === 1 ? "job" : "jobs"} this week`,
  toggleLabel: (crewName: string, count: number) => `${crewName}: ${count} ${count === 1 ? "job" : "jobs"} this week`,
} as const;

export const CREW_ARCHIVE_BLOCK_COPY = {
  heading: (crewName: string) => `${crewName} is still the crew on:`,
  hiddenJobs: (count: number) => `and ${count} more ${count === 1 ? "job" : "jobs"} you can't open`,
  help: "Remove or replace the crew on that job, then archive. Lost and completed jobs never block.",
  close: "Close",
} as const;
