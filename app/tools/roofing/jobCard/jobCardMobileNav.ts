/**
 * Phase 8 / Astra §21 — Job Card mobile primary nav + More destinations.
 * Desktop retains JOB_CARD_VISIBLE_TABS. Domain writers are unchanged.
 */

import {
  JOB_CARD_VISIBLE_TAB_IDS,
  type JobCardVisibleTabId,
} from "./jobCardTypes";

/** Primary rail at true mobile widths (390). Photos maps to attachments domain. */
export const JOB_CARD_MOBILE_PRIMARY_NAV = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "attachments", label: "Photos" },
] as const satisfies readonly {
  id: JobCardVisibleTabId;
  label: string;
}[];

export type JobCardMobilePrimaryNavId =
  (typeof JOB_CARD_MOBILE_PRIMARY_NAV)[number]["id"];

/** More sheet destinations — real domains + Activity chronology (not a domain writer). */
export const JOB_CARD_MORE_DESTINATIONS = [
  { id: "calendar", label: "Calendar", kind: "tab" },
  { id: "measurements", label: "Measurements", kind: "tab" },
  { id: "proposals", label: "Proposals", kind: "tab" },
  { id: "payments", label: "Payments", kind: "tab" },
  { id: "activity", label: "Activity", kind: "activity" },
] as const;

export type JobCardMoreDestinationId =
  (typeof JOB_CARD_MORE_DESTINATIONS)[number]["id"];

export type JobCardMoreTabDestinationId = Exclude<
  JobCardMoreDestinationId,
  "activity"
>;

/** Viewport width at/above which the full desktop tab set is shown. */
export const JOB_CARD_DESKTOP_NAV_MIN_WIDTH = 1200;

/** Canonical workspace owner for each visible tab id (Photos label → attachments). */
export const JOB_CARD_DOMAIN_WORKSPACE = {
  overview: "overview",
  tasks: "tasks",
  calendar: "calendar",
  measurements: "measurements",
  proposals: "proposals",
  payments: "payments",
  attachments: "attachments",
} as const satisfies Record<JobCardVisibleTabId, JobCardVisibleTabId>;

export function resolveJobCardDomainWorkspace(
  tab: string | null | undefined
): JobCardVisibleTabId {
  const raw = String(tab ?? "").trim();
  if (raw === "photos") return "attachments";
  if ((JOB_CARD_VISIBLE_TAB_IDS as readonly string[]).includes(raw)) {
    return raw as JobCardVisibleTabId;
  }
  return "overview";
}

export function isJobCardMobilePrimaryNavId(
  value: string | null | undefined
): value is JobCardMobilePrimaryNavId {
  return JOB_CARD_MOBILE_PRIMARY_NAV.some((item) => item.id === value);
}

export function isJobCardMoreDestinationId(
  value: string | null | undefined
): value is JobCardMoreDestinationId {
  return JOB_CARD_MORE_DESTINATIONS.some((item) => item.id === value);
}

export function isJobCardMoreTabDestination(
  value: string | null | undefined
): value is JobCardMoreTabDestinationId {
  return (
    isJobCardMoreDestinationId(value) &&
    value !== "activity" &&
    (JOB_CARD_VISIBLE_TAB_IDS as readonly string[]).includes(value)
  );
}

/** True when the active domain is reached via More (not a primary rail item). */
export function isJobCardMoreActiveDestination(
  activeTab: string,
  mobileActivityFocused: boolean
): boolean {
  if (mobileActivityFocused) return true;
  return isJobCardMoreTabDestination(activeTab);
}

/**
 * Mobile rail selection model: primary tabs highlight themselves;
 * More highlights when a More destination (or Activity) is active.
 */
export function resolveJobCardMobileRailSelection(
  activeTab: string,
  mobileActivityFocused: boolean
): "overview" | "tasks" | "attachments" | "more" {
  if (mobileActivityFocused) return "more";
  const domain = resolveJobCardDomainWorkspace(activeTab);
  if (isJobCardMobilePrimaryNavId(domain)) return domain;
  if (isJobCardMoreTabDestination(domain)) return "more";
  return "overview";
}

/** Every visible domain remains reachable: primary + More tabs (Activity is chronology). */
export function jobCardMobileNavCoversAllVisibleDomains(): boolean {
  const covered = new Set<string>([
    ...JOB_CARD_MOBILE_PRIMARY_NAV.map((item) => item.id),
    ...JOB_CARD_MORE_DESTINATIONS.filter((item) => item.kind === "tab").map(
      (item) => item.id
    ),
  ]);
  return JOB_CARD_VISIBLE_TAB_IDS.every((id) => covered.has(id));
}
