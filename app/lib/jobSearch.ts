/**
 * Stage-1 company job findability.
 * Matching helpers are pure. Live search runs through the authenticated API.
 */

import { buildDbJobCardHref } from "@/app/lib/jobBoardAdapter";
import { resolveCanonicalJobStageLabel } from "@/app/lib/jobLifecycleMapper";
import type { JobStage } from "@/app/lib/jobTypes";

export const JOB_SEARCH_MIN_QUERY_LENGTH = 2;
export const JOB_SEARCH_RESULT_LIMIT = 25;
export const JOB_SEARCH_DEBOUNCE_MS = 250;
export const JOB_SEARCH_PHONE_DIGIT_MIN = 7;

export type JobSearchResult = {
  id: string;
  customerName: string;
  address: string;
  stage: string;
  stageLabel: string;
  href: string;
};

export type JobSearchRow = {
  id: string;
  customer_name?: string | null;
  job_name?: string | null;
  address_formatted?: string | null;
  address_line1?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  stage?: string | null;
};

export function normalizeJobSearchQuery(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** Whitespace tokens used for Stage-1 AND matching across identity/address fields. */
export function tokenizeJobSearchQuery(input: string): string[] {
  return normalizeJobSearchQuery(input)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
}

export function normalizePhoneDigits(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

export function jobSearchQueryIsActive(input: string): boolean {
  return normalizeJobSearchQuery(input).length >= JOB_SEARCH_MIN_QUERY_LENGTH;
}

export function prepareJobSearchQuery(input: string): {
  raw: string;
  text: string;
  digits: string;
  looksLikeJobId: boolean;
} {
  const raw = normalizeJobSearchQuery(input);
  const digits = normalizePhoneDigits(raw);
  const compactId = raw.replace(/[^0-9a-fA-F-]/g, "");
  const looksLikeJobId =
    compactId.length >= 8 &&
    /^[0-9a-fA-F-]{8,36}$/.test(compactId) &&
    digits.length < JOB_SEARCH_PHONE_DIGIT_MIN;
  return {
    raw,
    text: raw.toLowerCase(),
    digits,
    looksLikeJobId,
  };
}

function formatSearchAddress(row: JobSearchRow): string {
  const formatted = String(row.address_formatted ?? "").trim();
  if (formatted) return formatted;
  return [row.address_line1, row.address_city, row.address_state, row.address_zip]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function resolveSearchCustomerName(row: JobSearchRow): string {
  const name = String(row.customer_name ?? "").trim();
  if (name) return name;
  return String(row.job_name ?? "").replace(/ — roofing$/i, "").trim() || "Job";
}

export function mapJobSearchRowToResult(row: JobSearchRow): JobSearchResult | null {
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const stage = String(row.stage ?? "").trim() || "intake";
  return {
    id,
    customerName: resolveSearchCustomerName(row),
    address: formatSearchAddress(row),
    stage,
    stageLabel: resolveCanonicalJobStageLabel({ stage: stage as JobStage }),
    href: buildDbJobCardHref(id),
  };
}

export function parseJobSearchApiPayload(json: unknown): JobSearchResult[] {
  if (!json || typeof json !== "object") return [];
  const jobs = (json as { jobs?: unknown }).jobs;
  if (!Array.isArray(jobs)) return [];
  const out: JobSearchResult[] = [];
  for (const item of jobs) {
    if (!item || typeof item !== "object") continue;
    const row = item as JobSearchResult;
    if (!row.id || !row.href) continue;
    out.push({
      id: String(row.id),
      customerName: String(row.customerName ?? "Job"),
      address: String(row.address ?? ""),
      stage: String(row.stage ?? "intake"),
      stageLabel: String(row.stageLabel ?? "Intake"),
      href: String(row.href),
    });
  }
  return out.slice(0, JOB_SEARCH_RESULT_LIMIT);
}
