/**
 * User-facing R3H Activity composition.
 * The paired stage_changed(reason=work_completed) row remains durable but hidden.
 */

import { formatJobCompletedAt } from "@/app/lib/jobCompleteTypes";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";

export function isSuppressedCompleteStageChange(
  event: JobActivityEvent
): boolean {
  return (
    event.event_type === "stage_changed" &&
    String(event.payload_json?.reason ?? "").trim() === "work_completed"
  );
}

export function composeCompleteActivityItem(
  event: JobActivityEvent,
  timezone?: string | null
): { label: string; note: string } | null {
  if (event.event_type !== "job_work_completed") return null;
  const plannedWindow =
    event.payload_json?.planned_window &&
    typeof event.payload_json.planned_window === "object"
      ? (event.payload_json.planned_window as Record<string, unknown>)
      : null;
  const resolvedTimezone =
    timezone ??
    (typeof plannedWindow?.timezone === "string"
      ? plannedWindow.timezone
      : null);
  const completedAt =
    typeof event.payload_json?.completed_at === "string"
      ? event.payload_json.completed_at
      : event.occurred_at;
  return {
    label: "Work completed",
    note:
      formatJobCompletedAt(completedAt, resolvedTimezone) ?? "Job completed",
  };
}
