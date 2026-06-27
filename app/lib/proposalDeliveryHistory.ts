/**
 * R18D3C2 — Pure contractor delivery history read path.
 *
 * Read-only. No Resend, routes, lifecycle, or proposal_events writes.
 */

import type { ListProposalDeliveryAttemptsInput } from "@/app/lib/proposalDeliveryAttemptTypes";
import type { ProposalDeliveryAttemptRow } from "@/app/lib/proposalDeliveryAttemptTypes";
import {
  buildProposalDeliveryHistoryViewModel,
  type ProposalDeliveryHistoryViewModel,
} from "@/app/lib/proposalDeliveryAttemptViewModel";
import { isUuidLike } from "@/app/lib/jobStore";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";

export type GetProposalDeliveryHistoryInput = {
  companyId: string;
  proposalId: string;
  jobId?: string;
};

export type GetProposalDeliveryHistoryError =
  | "missing_proposal_id"
  | "invalid_proposal";

export type GetProposalDeliveryHistoryResult =
  | { ok: true; history: ProposalDeliveryHistoryViewModel }
  | { ok: false; error: GetProposalDeliveryHistoryError };

export type GetProposalDeliveryHistoryDeps = {
  getProposal: (companyId: string, proposalId: string) => Promise<ProposalRecord | null>;
  listDeliveryAttempts: (
    input: ListProposalDeliveryAttemptsInput
  ) => Promise<ProposalDeliveryAttemptRow[]>;
};

export async function getProposalDeliveryHistory(
  input: GetProposalDeliveryHistoryInput,
  deps: GetProposalDeliveryHistoryDeps
): Promise<GetProposalDeliveryHistoryResult> {
  const companyId = input.companyId.trim();
  const proposalId = input.proposalId.trim();
  const jobId = input.jobId?.trim() ?? "";

  if (proposalId.length === 0) {
    return { ok: false, error: "missing_proposal_id" };
  }

  if (!isUuidLike(companyId) || !isUuidLike(proposalId)) {
    return { ok: false, error: "invalid_proposal" };
  }

  if (jobId.length > 0 && !isUuidLike(jobId)) {
    return { ok: false, error: "invalid_proposal" };
  }

  const proposal = await deps.getProposal(companyId, proposalId);
  if (!proposal) {
    return { ok: false, error: "invalid_proposal" };
  }

  if (jobId.length > 0 && (proposal.job_id ?? "").trim() !== jobId) {
    return { ok: false, error: "invalid_proposal" };
  }

  const rows = await deps.listDeliveryAttempts({
    company_id: companyId,
    proposal_id: proposalId,
  });

  return {
    ok: true,
    history: buildProposalDeliveryHistoryViewModel(rows),
  };
}
