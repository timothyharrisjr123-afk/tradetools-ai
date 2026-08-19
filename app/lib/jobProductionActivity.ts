/**
 * User-facing R3G Activity composition.
 * The paired stage_changed(reason=work_started) row remains durable but hidden.
 */

import { formatProductionStartedAt } from "@/app/lib/jobProductionTypes";
import type { JobActivityEvent } from "@/app/lib/jobLifecycleTypes";

export function isSuppressedProductionStageChange(
  event: JobActivityEvent
): boolean {
  return (
    event.event_type === "stage_changed" &&
    String(event.payload_json?.reason ?? "").trim() === "work_started"
  );
}

export function composeProductionActivityItem(
  event: JobActivityEvent,
  timezone?: string | null
): { label: string; note: string } | null {
  if (event.event_type !== "job_work_started") return null;
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
  const startedAt =
    typeof event.payload_json?.production_started_at === "string"
      ? event.payload_json.production_started_at
      : event.created_at;
  return {
    label: "Work started",
    note:
      formatProductionStartedAt(startedAt, resolvedTimezone) ??
      "Production started",
  };
}

