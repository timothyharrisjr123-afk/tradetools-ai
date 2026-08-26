/**
 * Job Card tab catalog.
 *
 * JOB_CARD_TABS retains every implemented tab id (code under the hood).
 * JOB_CARD_VISIBLE_TABS is the current contractor-facing navigation.
 *
 * Hidden / deferred (code retained, not deleted):
 * - work_orders — DEFERRED / UNCOMMITTED
 * - invoices — DEFERRED / UNCOMMITTED
 * - material_orders — future core, nonfunctional placeholder — hidden for clarity
 * - job_costing — future core, nonfunctional placeholder — hidden for clarity
 * - instant_estimate — PLACEHOLDER (shell only) — hidden for clarity
 *
 * Attachments and Measurements remain visible (core FieldDive capabilities).
 */

export const JOB_CARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "calendar", label: "Calendar" },
  { id: "measurements", label: "Measurements" },
  { id: "proposals", label: "Proposals" },
  { id: "material_orders", label: "Material Orders" },
  { id: "work_orders", label: "Work Orders" },
  { id: "invoices", label: "Invoices" },
  { id: "job_costing", label: "Job Costing" },
  { id: "attachments", label: "Attachments" },
  { id: "instant_estimate", label: "Instant Estimate" },
] as const;

export type JobCardTabId = (typeof JOB_CARD_TABS)[number]["id"];

/** Tabs shown in the current product Job Card navigation. */
export const JOB_CARD_VISIBLE_TAB_IDS = [
  "overview",
  "tasks",
  "calendar",
  "measurements",
  "proposals",
  "attachments",
] as const satisfies readonly JobCardTabId[];

export type JobCardVisibleTabId = (typeof JOB_CARD_VISIBLE_TAB_IDS)[number];

export const JOB_CARD_VISIBLE_TABS = JOB_CARD_TABS.filter((tab) =>
  (JOB_CARD_VISIBLE_TAB_IDS as readonly string[]).includes(tab.id)
);

/** Tabs retained in code but hidden from current navigation. */
export const JOB_CARD_HIDDEN_TAB_IDS = [
  "material_orders",
  "work_orders",
  "invoices",
  "job_costing",
  "instant_estimate",
] as const satisfies readonly JobCardTabId[];

export function isJobCardVisibleTabId(
  value: string | null | undefined
): value is JobCardVisibleTabId {
  return (JOB_CARD_VISIBLE_TAB_IDS as readonly string[]).includes(
    String(value ?? "")
  );
}

export function coerceJobCardVisibleTab(
  value: string | null | undefined
): JobCardVisibleTabId {
  return isJobCardVisibleTabId(value) ? value : "overview";
}
