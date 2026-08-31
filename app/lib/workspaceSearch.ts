/**
 * Wave C — typed Job / Customer / Property findability.
 * Matching helpers are pure. Live search runs through GET /api/search.
 */

import { buildDbJobCardHref } from "@/app/lib/jobBoardAdapter";
import { resolveCanonicalJobStageLabel } from "@/app/lib/jobLifecycleMapper";
import type { JobStage } from "@/app/lib/jobTypes";
import {
  buildCustomerWorkspaceHref,
  buildPropertyWorkspaceHref,
} from "@/app/lib/propertyAddressNormalize";
import {
  JOB_SEARCH_DEBOUNCE_MS,
  JOB_SEARCH_MIN_QUERY_LENGTH,
  jobSearchQueryIsActive,
  normalizeJobSearchQuery,
} from "@/app/lib/jobSearch";

export const WORKSPACE_SEARCH_MIN_QUERY_LENGTH = JOB_SEARCH_MIN_QUERY_LENGTH;
export const WORKSPACE_SEARCH_DEBOUNCE_MS = JOB_SEARCH_DEBOUNCE_MS;
export const WORKSPACE_SEARCH_RESULT_LIMIT = 24;
export const WORKSPACE_SEARCH_TYPE_LIMIT = 8;

export type WorkspaceSearchEntityType = "job" | "customer" | "property";

export type WorkspaceSearchResult = {
  type: WorkspaceSearchEntityType;
  id: string;
  primary: string;
  secondary: string | null;
  href: string;
  stage?: string | null;
  stageLabel?: string | null;
};

export type WorkspaceSearchRow = {
  entity_type?: string | null;
  id: string;
  primary_label?: string | null;
  secondary_label?: string | null;
  job_stage?: string | null;
};

export function workspaceSearchQueryIsActive(input: string): boolean {
  return jobSearchQueryIsActive(input);
}

export function mapWorkspaceSearchRowToResult(
  row: WorkspaceSearchRow
): WorkspaceSearchResult | null {
  const id = String(row.id ?? "").trim();
  const type = String(row.entity_type ?? "").trim() as WorkspaceSearchEntityType;
  if (!id || (type !== "job" && type !== "customer" && type !== "property")) {
    return null;
  }

  const primary = String(row.primary_label ?? "").trim() || labelForType(type);
  const secondary = String(row.secondary_label ?? "").trim() || null;
  const stage = type === "job" ? String(row.job_stage ?? "").trim() || "intake" : null;

  return {
    type,
    id,
    primary,
    secondary,
    href: hrefForType(type, id),
    stage,
    stageLabel: stage
      ? resolveCanonicalJobStageLabel({ stage: stage as JobStage })
      : null,
  };
}

export function parseWorkspaceSearchApiPayload(json: unknown): WorkspaceSearchResult[] {
  if (!json || typeof json !== "object") return [];
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const out: WorkspaceSearchResult[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const row = item as WorkspaceSearchResult;
    if (!row.id || !row.href || !row.type) continue;
    if (row.type !== "job" && row.type !== "customer" && row.type !== "property") {
      continue;
    }
    out.push({
      type: row.type,
      id: String(row.id),
      primary: String(row.primary ?? labelForType(row.type)),
      secondary: row.secondary ? String(row.secondary) : null,
      href: String(row.href),
      stage: row.stage ? String(row.stage) : null,
      stageLabel: row.stageLabel ? String(row.stageLabel) : null,
    });
  }
  return out.slice(0, WORKSPACE_SEARCH_RESULT_LIMIT);
}

export function groupWorkspaceSearchResults(results: WorkspaceSearchResult[]): {
  jobs: WorkspaceSearchResult[];
  customers: WorkspaceSearchResult[];
  properties: WorkspaceSearchResult[];
} {
  return {
    jobs: results.filter((row) => row.type === "job"),
    customers: results.filter((row) => row.type === "customer"),
    properties: results.filter((row) => row.type === "property"),
  };
}

function labelForType(type: WorkspaceSearchEntityType): string {
  if (type === "customer") return "Customer";
  if (type === "property") return "Property";
  return "Job";
}

function hrefForType(type: WorkspaceSearchEntityType, id: string): string {
  if (type === "customer") return buildCustomerWorkspaceHref(id);
  if (type === "property") return buildPropertyWorkspaceHref(id);
  return buildDbJobCardHref(id);
}

export function workspaceSearchEmptyCopy(query: string): string {
  const q = normalizeJobSearchQuery(query);
  return q ? `No jobs, customers, or properties match “${q}”.` : "No matches.";
}
