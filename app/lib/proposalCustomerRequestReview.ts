/**
 * R3B3 — Pure contractor customer-request review read path.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import type {
  ProposalCustomerRequestContractorRow,
  ProposalCustomerRequestReviewStatus,
  ProposalCustomerRequestStatusUpdateResult,
} from "@/app/lib/proposalCustomerRequestPersistence";
import {
  buildCustomerRequestReviewItemView,
  type CustomerRequestReviewItemView,
} from "@/app/lib/proposalCustomerRequestReviewViewModel";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";

export type GetProposalCustomerRequestsInput = {
  companyId: string;
  proposalId: string;
  jobId?: string;
};

export type GetProposalCustomerRequestsError =
  | "missing_proposal_id"
  | "invalid_proposal"
  | "forbidden";

export type GetProposalCustomerRequestsResult =
  | { ok: true; requests: CustomerRequestReviewItemView[] }
  | { ok: false; error: GetProposalCustomerRequestsError };

export type GetProposalCustomerRequestsDeps = {
  getProposal: (companyId: string, proposalId: string) => Promise<ProposalRecord | null>;
  listRequests: (input: {
    company_id: string;
    proposal_id: string;
  }) => Promise<ProposalCustomerRequestContractorRow[]>;
};

export async function getProposalCustomerRequestsForContractor(
  input: GetProposalCustomerRequestsInput,
  deps: GetProposalCustomerRequestsDeps
): Promise<GetProposalCustomerRequestsResult> {
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

  const rows = await deps.listRequests({
    company_id: companyId,
    proposal_id: proposalId,
  });

  return {
    ok: true,
    requests: rows.map(buildCustomerRequestReviewItemView),
  };
}

export type UpdateProposalCustomerRequestStatusInput = {
  companyId: string;
  requestId: string;
  status: ProposalCustomerRequestReviewStatus;
  /** Optional — when provided, verify request belongs to this proposal. */
  proposalId?: string;
  jobId?: string;
};

export type UpdateProposalCustomerRequestStatusDeps = {
  getProposal: (companyId: string, proposalId: string) => Promise<ProposalRecord | null>;
  listRequests: (input: {
    company_id: string;
    proposal_id: string;
  }) => Promise<ProposalCustomerRequestContractorRow[]>;
  updateStatus: (input: {
    requestId: string;
    status: ProposalCustomerRequestReviewStatus;
  }) => Promise<ProposalCustomerRequestStatusUpdateResult>;
};

export type UpdateProposalCustomerRequestStatusAppResult =
  | {
      ok: true;
      request: CustomerRequestReviewItemView;
      proposal_status_unchanged: string | null;
      selected_option_id_unchanged: string | null;
      job_stage_unchanged: string | null;
    }
  | {
      ok: false;
      error:
        | GetProposalCustomerRequestsError
        | "invalid_request"
        | "invalid_status"
        | "invalid_transition"
        | "not_found"
        | "unauthorized";
    };

export async function updateProposalCustomerRequestStatusForContractor(
  input: UpdateProposalCustomerRequestStatusInput,
  deps: UpdateProposalCustomerRequestStatusDeps
): Promise<UpdateProposalCustomerRequestStatusAppResult> {
  const companyId = input.companyId.trim();
  const requestId = input.requestId.trim();
  const proposalId = input.proposalId?.trim() ?? "";
  const jobId = input.jobId?.trim() ?? "";

  if (!isUuidLike(companyId) || !isUuidLike(requestId)) {
    return { ok: false, error: "invalid_request" };
  }

  if (input.status !== "seen" && input.status !== "dismissed") {
    return { ok: false, error: "invalid_status" };
  }

  const rpcResult = await deps.updateStatus({
    requestId,
    status: input.status,
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === "unauthorized") return { ok: false, error: "unauthorized" };
    if (rpcResult.code === "forbidden") return { ok: false, error: "forbidden" };
    if (rpcResult.code === "not_found") return { ok: false, error: "not_found" };
    if (rpcResult.code === "invalid_transition") {
      return { ok: false, error: "invalid_transition" };
    }
    if (rpcResult.code === "invalid_status") {
      return { ok: false, error: "invalid_status" };
    }
    return { ok: false, error: "invalid_request" };
  }

  if (proposalId && rpcResult.proposal_id !== proposalId) {
    return { ok: false, error: "invalid_proposal" };
  }

  if (jobId) {
    const proposal = await deps.getProposal(companyId, rpcResult.proposal_id);
    if (!proposal || (proposal.job_id ?? "").trim() !== jobId) {
      return { ok: false, error: "invalid_proposal" };
    }
  }

  const rows = await deps.listRequests({
    company_id: companyId,
    proposal_id: rpcResult.proposal_id,
  });
  const updated = rows.find((row) => row.id === rpcResult.request_id);
  if (!updated) {
    return { ok: false, error: "not_found" };
  }

  return {
    ok: true,
    request: buildCustomerRequestReviewItemView(updated),
    proposal_status_unchanged: rpcResult.proposal_status_unchanged,
    selected_option_id_unchanged: rpcResult.selected_option_id_unchanged,
    job_stage_unchanged: rpcResult.job_stage_unchanged,
  };
}
