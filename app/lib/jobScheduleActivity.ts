/**
 * User-facing Activity labels for schedule events.
 * Stage-changed rows with scheduled_job / unscheduled_job reasons are suppressed
 * so one contractor action is one visible Activity item.
 */

import {
  formatScheduleWindowLabel,
  parseScheduleWindowPayload,
} from "@/app/lib/jobScheduleMapper";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";

export const SCHEDULE_STAGE_CHANGE_REASONS = [
  "scheduled_job",
  "unscheduled_job",
] as const;

export function isSuppressedScheduleStageChange(
  event: JobActivityEvent
): boolean {
  if (event.event_type !== "stage_changed") return false;
  const reason = String(event.payload_json?.reason ?? "").trim();
  return (SCHEDULE_STAGE_CHANGE_REASONS as readonly string[]).includes(reason);
}

export function composeScheduleActivityItem(event: JobActivityEvent): {
  label: string;
  note: string;
} | null {
  const payload = event.payload_json ?? {};
  if (event.event_type === "job_scheduled") {
    const window =
      parseScheduleWindowPayload(payload.window) ??
      parseScheduleWindowPayload(payload);
    return {
      label: "Work scheduled",
      note: window ? formatScheduleWindowLabel(window) : "",
    };
  }
  if (event.event_type === "job_rescheduled") {
    const next =
      parseScheduleWindowPayload(payload.window) ??
      parseScheduleWindowPayload(payload);
    return {
      label: "Work rescheduled",
      note: next ? formatScheduleWindowLabel(next) : "",
    };
  }
  if (event.event_type === "job_unscheduled") {
    return {
      label: "Work schedule removed",
      note: "",
    };
  }
  return null;
}
