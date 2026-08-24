/**
 * Proposal Preview independent-read ownership.
 *
 * Job identity, frozen/draft proposal graph, and catalog enrichment are
 * separate truths. Catalog failure must not fabricate a missing proposal.
 * Frozen proposal graph remains authoritative — live catalog is enrichment only.
 */

export type IndependentReadStatus =
  | "loading"
  | "ready"
  | "error"
  | "not_available";

export type IndependentRead<T> = {
  status: IndependentReadStatus;
  value: T | null;
  error: string | null;
};

export function createIndependentRead<T>(): IndependentRead<T> {
  return { status: "loading", value: null, error: null };
}

export function applyIndependentReadSuccess<T>(
  value: T | null | undefined
): IndependentRead<T> {
  if (value == null) {
    return { status: "not_available", value: null, error: null };
  }
  return { status: "ready", value, error: null };
}

export function applyIndependentReadFailure<T>(
  previous: IndependentRead<T>,
  error: string,
  keepLastKnown: boolean
): IndependentRead<T> {
  const message = error.trim() || "Could not load.";
  return {
    status: "error",
    value: keepLastKnown ? previous.value : null,
    error: message,
  };
}

export function shouldApplyProposalContextResult(input: {
  requestGeneration: number;
  currentGeneration: number;
  requestProposalId: string;
  currentProposalId: string;
  requestJobId: string;
  currentJobId: string;
}): boolean {
  if (input.requestGeneration !== input.currentGeneration) return false;
  const requestProposal = String(input.requestProposalId ?? "").trim();
  const currentProposal = String(input.currentProposalId ?? "").trim();
  const requestJob = String(input.requestJobId ?? "").trim();
  const currentJob = String(input.currentJobId ?? "").trim();
  if (requestProposal !== currentProposal) return false;
  if (requestJob !== currentJob) return false;
  return true;
}

export type PreviewJobIdentityMode =
  | "loading"
  | "ready"
  | "not_found"
  | "unavailable";

export type PreviewSurfaceDecision = {
  overall: IndependentReadStatus;
  blockingError: string | null;
  canRenderProposal: boolean;
  catalogError: string | null;
  jobIdentityMode: PreviewJobIdentityMode;
};

export function decidePreviewSurface(input: {
  job: IndependentRead<unknown>;
  graph: IndependentRead<unknown>;
  catalog: IndependentRead<unknown>;
  routeError?: string | null;
}): PreviewSurfaceDecision {
  const routeError = (input.routeError ?? "").trim();
  if (routeError) {
    return {
      overall: "error",
      blockingError: routeError,
      canRenderProposal: false,
      catalogError: null,
      jobIdentityMode: "unavailable",
    };
  }

  const jobIdentityMode: PreviewJobIdentityMode =
    input.job.status === "ready"
      ? "ready"
      : input.job.status === "not_available"
        ? "not_found"
        : input.job.status === "error"
          ? "unavailable"
          : "loading";

  const catalogError =
    input.catalog.status === "error"
      ? input.catalog.error ?? "Catalog unavailable."
      : null;

  if (input.graph.status === "error") {
    return {
      overall: "error",
      blockingError:
        input.graph.error ?? "Could not load persisted proposal draft.",
      canRenderProposal: false,
      catalogError,
      jobIdentityMode,
    };
  }

  if (input.graph.status === "not_available") {
    return {
      overall: "not_available",
      blockingError: "Could not load persisted proposal draft.",
      canRenderProposal: false,
      catalogError,
      jobIdentityMode,
    };
  }

  if (input.graph.status === "ready" && input.graph.value != null) {
    return {
      overall: "ready",
      blockingError: null,
      canRenderProposal: true,
      catalogError,
      jobIdentityMode,
    };
  }

  return {
    overall: "loading",
    blockingError: null,
    canRenderProposal: false,
    catalogError,
    jobIdentityMode,
  };
}

export function previewJobIdentityFallback(
  mode: PreviewJobIdentityMode
): string {
  if (mode === "ready") return "Proposal preview";
  if (mode === "not_found") return "Job not found";
  if (mode === "unavailable") return "Job identity unavailable";
  return "Loading job…";
}
