/**
 * Pure product spine classification — DB proposal vs legacy estimate boundaries.
 *
 * No React, browser APIs, or localStorage. Callers pass explicit route/query hints.
 */

import { isUuidLike } from "@/app/lib/uuid";

export type ProductSpine =
  | "db_job"
  | "db_proposal_builder"
  | "db_proposal_preview"
  | "legacy_estimate"
  | "legacy_approval"
  | "unknown";

export type ProductSpineRouteHints = {
  pathname?: string | null;
  entry?: string | null;
  job?: string | null;
  proposal?: string | null;
  loadSaved?: string | null;
  from?: string | null;
};

export type ProductSpineClassification = {
  spine: ProductSpine;
  isMixedContext: boolean;
};

export type DbProposalLaunchEvaluation = {
  allowed: boolean;
  reason: "mixed_spine_context" | "legacy_spine_blocked" | null;
  errorMessage: string | null;
  normalizeHref: string | null;
};

export const DB_PROPOSAL_LAUNCH_MIXED_MESSAGE =
  "Open this job from a clean DB Job Card before creating or opening proposal drafts.";

export const DB_PROPOSAL_LAUNCH_LEGACY_BLOCKED_MESSAGE =
  "Proposal drafts require a DB Job Card route — legacy saved estimate sessions cannot create or open DB proposals.";

const LEGACY_FROM_BOARD = "board";

function normalizeHint(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasLegacyLoadSaved(hints: ProductSpineRouteHints): boolean {
  return Boolean(normalizeHint(hints.loadSaved));
}

function hasLegacyFromBoard(hints: ProductSpineRouteHints): boolean {
  return normalizeHint(hints.from) === LEGACY_FROM_BOARD;
}

function hasDbJobUuid(hints: ProductSpineRouteHints): boolean {
  return isUuidLike(normalizeHint(hints.job) ?? "");
}

function hasDbProposalUuid(hints: ProductSpineRouteHints): boolean {
  return isUuidLike(normalizeHint(hints.proposal) ?? "");
}

function normalizedPathname(hints: ProductSpineRouteHints): string {
  return normalizeHint(hints.pathname) ?? "";
}

/** True when legacy and DB spine hints appear together on one route. */
export function isMixedSpineContext(hints: ProductSpineRouteHints): boolean {
  const loadSaved = hasLegacyLoadSaved(hints);
  const jobUuid = hasDbJobUuid(hints);
  const fromBoard = hasLegacyFromBoard(hints);
  const pathname = normalizedPathname(hints);

  if (loadSaved && jobUuid) return true;

  if (jobUuid && fromBoard && !loadSaved) return true;

  if (
    (pathname.includes("/proposals/builder") || pathname.includes("/proposals/preview")) &&
    (loadSaved || fromBoard)
  ) {
    return true;
  }

  return false;
}

export function classifyProductSpine(hints: ProductSpineRouteHints): ProductSpineClassification {
  if (isMixedSpineContext(hints)) {
    return { spine: "unknown", isMixedContext: true };
  }

  const pathname = normalizedPathname(hints);

  if (pathname.includes("/approve/")) {
    return { spine: "legacy_approval", isMixedContext: false };
  }

  if (hasLegacyLoadSaved(hints)) {
    return { spine: "legacy_estimate", isMixedContext: false };
  }

  if (
    pathname.includes("/proposals/preview") &&
    hasDbJobUuid(hints) &&
    hasDbProposalUuid(hints)
  ) {
    return { spine: "db_proposal_preview", isMixedContext: false };
  }

  if (pathname.includes("/proposals/builder") && hasDbJobUuid(hints)) {
    return { spine: "db_proposal_builder", isMixedContext: false };
  }

  const entry = normalizeHint(hints.entry);
  if (entry === "job-card" && hasDbJobUuid(hints) && !hasLegacyFromBoard(hints)) {
    return { spine: "db_job", isMixedContext: false };
  }

  if (pathname.includes("/proposals/builder") || pathname.includes("/proposals/preview")) {
    return { spine: "unknown", isMixedContext: false };
  }

  return { spine: "unknown", isMixedContext: false };
}

export function buildCleanDbJobCardHref(jobId: string): string {
  return `/tools/roofing?entry=job-card&job=${encodeURIComponent(jobId)}`;
}

/** Strip legacy-only query params from internal DB proposal / job hrefs. */
export function normalizeDbProposalHref(href: string): string {
  const trimmed = (href ?? "").trim();
  if (!trimmed.startsWith("/")) return trimmed;

  const queryIndex = trimmed.indexOf("?");
  if (queryIndex === -1) return trimmed;

  const path = trimmed.slice(0, queryIndex);
  const params = new URLSearchParams(trimmed.slice(queryIndex + 1));
  params.delete("loadSaved");
  params.delete("from");
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

export function isDbProposalLaunchSpine(hints: ProductSpineRouteHints): boolean {
  const { spine, isMixedContext } = classifyProductSpine(hints);
  if (isMixedContext) return false;
  return (
    spine === "db_job" ||
    spine === "db_proposal_builder" ||
    spine === "db_proposal_preview"
  );
}

export function productSpineRouteHintsFromSearchParams(
  pathname: string,
  params: {
    get(name: string): string | null;
  }
): ProductSpineRouteHints {
  return {
    pathname,
    entry: params.get("entry"),
    job: params.get("job"),
    proposal: params.get("proposal"),
    loadSaved: params.get("loadSaved"),
    from: params.get("from"),
  };
}

/**
 * Evaluate whether DB proposal create/open is allowed from the given route hints.
 * When hints are omitted, returns allowed (callers that omit hints are test-only legacy paths).
 */
export function evaluateDbProposalLaunchSpine(
  hints: ProductSpineRouteHints | null | undefined
): DbProposalLaunchEvaluation {
  if (!hints) {
    return {
      allowed: true,
      reason: null,
      errorMessage: null,
      normalizeHref: null,
    };
  }

  const jobId = normalizeHint(hints.job);

  if (isMixedSpineContext(hints)) {
    return {
      allowed: false,
      reason: "mixed_spine_context",
      errorMessage: DB_PROPOSAL_LAUNCH_MIXED_MESSAGE,
      normalizeHref: jobId && isUuidLike(jobId) ? buildCleanDbJobCardHref(jobId) : null,
    };
  }

  const { spine } = classifyProductSpine(hints);

  if (spine === "legacy_estimate" || spine === "legacy_approval") {
    return {
      allowed: false,
      reason: "legacy_spine_blocked",
      errorMessage: DB_PROPOSAL_LAUNCH_LEGACY_BLOCKED_MESSAGE,
      normalizeHref: jobId && isUuidLike(jobId) ? buildCleanDbJobCardHref(jobId) : null,
    };
  }

  if (!isDbProposalLaunchSpine(hints)) {
    return {
      allowed: false,
      reason: "mixed_spine_context",
      errorMessage: DB_PROPOSAL_LAUNCH_MIXED_MESSAGE,
      normalizeHref: jobId && isUuidLike(jobId) ? buildCleanDbJobCardHref(jobId) : null,
    };
  }

  return {
    allowed: true,
    reason: null,
    errorMessage: null,
    normalizeHref: null,
  };
}
