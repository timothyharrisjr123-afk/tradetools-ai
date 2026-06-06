/**
 * Read-only proposal draft entry resolution (3J3B).
 *
 * Determines whether a job already has an active draft proposal suitable for
 * Builder launch. Does not create, update, or mutate proposal/job rows.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";

export class ProposalDraftEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalDraftEntryError";
  }
}

export type ResolveProposalDraftEntryReason =
  | "no_active_proposal"
  | "proposal_not_found"
  | "wrong_company"
  | "wrong_job"
  | "non_draft_status"
  | "active_draft";

export type ResolveProposalDraftEntryInput = {
  companyId: string;
  jobId: string;
  activeProposalId?: string | null;
};

export type ResolveProposalDraftEntryResult = {
  proposalId: string | null;
  found: boolean;
  reason: ResolveProposalDraftEntryReason;
};

export type ProposalDraftEntryDeps = {
  getProposalById: (
    companyId: string,
    proposalId: string
  ) => Promise<ProposalRecord | null>;
};

function normalizeId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || !isUuidLike(trimmed)) return null;
  return trimmed;
}

/**
 * Read-only: resolve whether `activeProposalId` is a valid draft for this job.
 * Never writes to the database.
 */
export async function resolveProposalDraftEntry(
  input: ResolveProposalDraftEntryInput,
  deps: ProposalDraftEntryDeps
): Promise<ResolveProposalDraftEntryResult> {
  const companyId = normalizeId(input.companyId);
  const jobId = normalizeId(input.jobId);
  const activeProposalId = normalizeId(input.activeProposalId);

  if (!companyId || !jobId) {
    return { proposalId: null, found: false, reason: "no_active_proposal" };
  }

  if (!activeProposalId) {
    return { proposalId: null, found: false, reason: "no_active_proposal" };
  }

  const proposal = await deps.getProposalById(companyId, activeProposalId);
  if (!proposal) {
    return { proposalId: null, found: false, reason: "proposal_not_found" };
  }

  if (normalizeId(proposal.company_id) !== companyId) {
    return { proposalId: null, found: false, reason: "wrong_company" };
  }

  if (normalizeId(proposal.job_id) !== jobId) {
    return { proposalId: null, found: false, reason: "wrong_job" };
  }

  if (proposal.status !== "draft") {
    return { proposalId: null, found: false, reason: "non_draft_status" };
  }

  return {
    proposalId: activeProposalId,
    found: true,
    reason: "active_draft",
  };
}
