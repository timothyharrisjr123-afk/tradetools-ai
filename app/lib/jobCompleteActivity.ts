/**
 * User-facing R3H Activity composition.
 * The paired stage_changed(reason=work_completed) row remains durable but hidden.
 */

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
  void timezone;
  return {
    label: "Work completed",
    note: "",
  };
}
