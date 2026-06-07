/**
 * Map DB jobs to Job Board display rows (SMOKE-2E-BOARD).
 * Pure — no Supabase, React, or navigation side effects.
 */

import type { RoofingEstimate } from "@/app/lib/estimateStore";
import { isUuidLike } from "@/app/lib/jobStore";
import type { JobSummary } from "@/app/lib/jobTypes";
import type { BoardColumnKey } from "@/app/tools/roofing/saved/jobsBoardUtils";
import {
  getBoardColumnByKey,
  normalizeStatusValue,
} from "@/app/tools/roofing/saved/jobsBoardUtils";

/** Lane quick-filter values used by Job Board dark views and column headers. */
export type BoardLaneStatusFilter =
  | "all"
  | "estimate"
  | "sent_pending"
  | "approved"
  | "deposit_paid"
  | "scheduled"
  | "in_progress"
  | "paid";

export type BoardLaneScheduleOptions = {
  /** When filtering the scheduled lane, require a schedule date on the row. */
  hasSchedule?: (entry: RoofingEstimate) => boolean;
  scheduledView?: "all" | "upcoming" | "past";
  isPastScheduled?: (entry: RoofingEstimate) => boolean;
  parseScheduledSortKey?: (entry: RoofingEstimate) => number;
};

/** Prefix for synthetic board row ids — avoids collision with saved estimate uuids. */
export const DB_BOARD_JOB_ID_PREFIX = "dbjob:";

export type DbBoardJobCard = {
  jobId: string;
  customerName: string;
  address: string;
  stageLabel: string;
  boardColumnKey: BoardColumnKey;
  href: string;
  lastUpdatedIso: string | null;
  createdIso: string | null;
};

export function buildDbJobCardHref(jobId: string): string {
  return `/tools/roofing?entry=job-card&job=${encodeURIComponent(jobId)}`;
}

/** Session/local storage key for the last-opened DB Job Card id (recovery). */
export const LAST_DB_JOB_ID_STORAGE_KEY = "fielddive.lastDbJobId";

/**
 * Sidebar / recovery Job Card href.
 * Returns job= route when a valid last DB job id exists, otherwise the
 * plain Job Card route. Never uses loadSaved= or from=board.
 */
export function buildJobCardRecoveryHref(
  lastJobId: string | null | undefined
): string {
  const id = (lastJobId ?? "").toString().trim();
  if (id && isUuidLike(id)) {
    return buildDbJobCardHref(id);
  }
  return "/tools/roofing?entry=job-card";
}

export function isDbBoardJobEntry(entry: RoofingEstimate): boolean {
  return String(entry.id ?? "").startsWith(DB_BOARD_JOB_ID_PREFIX);
}

export function getDbJobIdFromBoardEntry(entry: RoofingEstimate): string | null {
  if (!isDbBoardJobEntry(entry)) return null;
  const fromField = entry.jobId?.trim();
  if (fromField && isUuidLike(fromField)) return fromField;
  const fromId = entry.id.slice(DB_BOARD_JOB_ID_PREFIX.length).trim();
  return isUuidLike(fromId) ? fromId : null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toString().trim();
}

function formatJobAddress(job: JobSummary): string {
  const addr = job.address;
  if (!addr) return "";
  const formatted = normalizeText(addr.formatted);
  if (formatted) return formatted;
  return [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
}

function resolveCustomerName(job: JobSummary): string {
  return (
    normalizeText(job.customer_name) ||
    normalizeText(job.job_name)?.replace(/ — roofing$/i, "") ||
    "New roofing job"
  );
}

/**
 * Map DB job workflow stage to a board column key compatible with existing lanes.
 */
export function mapDbJobStageToBoardColumnKey(job: JobSummary): BoardColumnKey {
  switch (job.stage) {
    case "approved":
      return "approved";
    case "production":
      return "in_progress";
    case "complete":
      return "paid";
    case "proposal":
      return job.active_proposal_id ? "leads" : "estimate";
    case "archived":
      return "paid";
    case "intake":
    case "measurement":
    case "estimating":
    default:
      return "estimate";
  }
}

/**
 * Map DB job stage to RoofingEstimate status for existing board column helpers.
 */
export function mapDbJobToEstimateStatus(
  job: JobSummary
): NonNullable<RoofingEstimate["status"]> {
  switch (job.stage) {
    case "approved":
      return "approved";
    case "production":
      return "in_progress";
    case "complete":
      return "paid";
    case "proposal":
      return job.active_proposal_id ? "sent_pending" : "estimate";
    default:
      return "estimate";
  }
}

export function mapDbJobToBoardCard(job: JobSummary): DbBoardJobCard {
  const boardColumnKey = mapDbJobStageToBoardColumnKey(job);
  return {
    jobId: job.id,
    customerName: resolveCustomerName(job),
    address: formatJobAddress(job) || "—",
    stageLabel: getBoardColumnByKey(boardColumnKey).label,
    boardColumnKey,
    href: buildDbJobCardHref(job.id),
    lastUpdatedIso:
      normalizeText(job.updated_at) ||
      normalizeText(job.last_activity_at) ||
      normalizeText(job.created_at) ||
      null,
    createdIso: normalizeText(job.created_at) || null,
  };
}

/**
 * Synthetic RoofingEstimate row for existing Job Board components.
 * Opens via job= href, not loadSaved=.
 */
export function mapDbJobToBoardEstimate(job: JobSummary): RoofingEstimate {
  const card = mapDbJobToBoardCard(job);
  const addr = job.address;
  return {
    id: `${DB_BOARD_JOB_ID_PREFIX}${job.id}`,
    jobId: job.id,
    createdAt: card.createdIso ?? new Date(0).toISOString(),
    lastSavedAt: card.lastUpdatedIso ?? card.createdIso ?? undefined,
    customerName: card.customerName,
    customerEmail: normalizeText(job.customer_email) || undefined,
    customerPhone: normalizeText(job.customer_phone) || undefined,
    address: card.address === "—" ? "" : card.address,
    zip: normalizeText(addr?.zip) || "",
    jobAddress1: normalizeText(addr?.line1) || undefined,
    jobCity: normalizeText(addr?.city) || undefined,
    jobState: normalizeText(addr?.state) || undefined,
    jobZip: normalizeText(addr?.zip) || undefined,
    roofAreaSqFt: 0,
    selectedTier: "Core",
    suggestedPrice: 0,
    status: mapDbJobToEstimateStatus(job),
    supabaseBacked: true,
  };
}

/**
 * Drop DB jobs already represented by a saved estimate linked via jobId.
 * Never drops DB-only jobs without a reliable linked estimate id.
 */
export function filterDbJobsForBoard(
  dbJobs: JobSummary[],
  estimates: RoofingEstimate[]
): JobSummary[] {
  const linkedJobIds = new Set<string>();

  for (const est of estimates) {
    const jid = normalizeText(est.jobId ?? null);
    if (jid && isUuidLike(jid)) {
      linkedJobIds.add(jid);
    }
  }

  return dbJobs.filter((job) => job.id && isUuidLike(job.id) && !linkedJobIds.has(job.id));
}

export function mergeDbJobsIntoBoardEstimates(
  estimates: RoofingEstimate[],
  dbJobs: JobSummary[]
): RoofingEstimate[] {
  const dbOnly = filterDbJobsForBoard(dbJobs, estimates);
  if (dbOnly.length === 0) return estimates;
  return [...estimates, ...dbOnly.map(mapDbJobToBoardEstimate)];
}

/**
 * Whether a board row (legacy estimate or DB synthetic row) belongs in a lane filter.
 */
export function entryMatchesLaneStatusFilter(
  entry: RoofingEstimate,
  statusFilter: BoardLaneStatusFilter,
  hasSchedule: (entry: RoofingEstimate) => boolean = () => false
): boolean {
  if (statusFilter === "all") return true;

  if (statusFilter === "scheduled") {
    const norm = normalizeStatusValue(entry.status || "estimate");
    return hasSchedule(entry) && (norm === "scheduled" || norm === "in_progress");
  }

  const s = entry.status || "estimate";
  const norm = normalizeStatusValue(s);
  if (statusFilter === "sent_pending") return norm === "pending" || s === "sent";
  return norm === normalizeStatusValue(statusFilter);
}

/**
 * Filter unified board rows by lane/status (Overview columns + dark Pipeline Lane).
 */
export function filterBoardEntriesByLaneStatus(
  entries: RoofingEstimate[],
  statusFilter: BoardLaneStatusFilter,
  options: BoardLaneScheduleOptions = {}
): RoofingEstimate[] {
  const hasSchedule = options.hasSchedule ?? (() => false);
  let list = entries.filter((e) =>
    entryMatchesLaneStatusFilter(e, statusFilter, hasSchedule)
  );

  if (statusFilter === "scheduled") {
    const scheduledView = options.scheduledView ?? "all";
    const isPastScheduled = options.isPastScheduled ?? (() => false);
    const parseScheduledSortKey = options.parseScheduledSortKey ?? (() => 0);

    list = list
      .filter((est) => {
        if (scheduledView === "all") return true;
        const past = isPastScheduled(est);
        return scheduledView === "past" ? past : !past;
      })
      .sort((a, b) => parseScheduledSortKey(a) - parseScheduledSortKey(b));
  }

  return list;
}

/** Search unified board rows by customer/name/address fields. */
export function searchBoardEntries(
  entries: RoofingEstimate[],
  query: string
): RoofingEstimate[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;

  return entries.filter((e) => {
    const hay = [
      e.customerName,
      e.customerEmail,
      e.customerPhone,
      e.address,
      e.jobAddress1,
      e.jobCity,
      e.jobState,
      e.jobZip,
      e.zip,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Count DB-only synthetic rows in a board source array. */
export function countDbBoardJobEntries(entries: RoofingEstimate[]): number {
  return entries.filter(isDbBoardJobEntry).length;
}
