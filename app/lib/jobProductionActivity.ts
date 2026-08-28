/**
 * User-facing R3G Activity composition.
 * The paired stage_changed(reason=work_started) row remains durable but hidden.
 */

import {
  formatScheduleWindowLabel,
  parseScheduleWindowPayload,
} from "@/app/lib/jobScheduleMapper";
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
  void timezone;
  const planned =
    parseScheduleWindowPayload(event.payload_json?.planned_window) ??
    parseScheduleWindowPayload(event.payload_json?.window);
  return {
    label: "Work started",
    note: planned ? formatScheduleWindowLabel(planned) : "",
  };
}

