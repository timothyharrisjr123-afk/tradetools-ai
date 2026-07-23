/**
 * R3B3 — Server-only contractor customer-request review wiring.
 */

import "server-only";

import {
  getProposalCustomerRequestsForContractor,
  updateProposalCustomerRequestStatusForContractor,
  type GetProposalCustomerRequestsInput,
  type GetProposalCustomerRequestsResult,
  type UpdateProposalCustomerRequestStatusAppResult,
  type UpdateProposalCustomerRequestStatusInput,
} from "@/app/lib/proposalCustomerRequestReview";
import {
  listProposalCustomerRequestsForProposalWithClient,
  updateProposalCustomerRequestStatusViaRpc,
  type ProposalCustomerRequestReviewStatus,
} from "@/app/lib/proposalCustomerRequestPersistence";
import { getProposalById } from "@/app/lib/proposalRecordStore";
import { createClient } from "@/app/lib/supabase/server";

export type {
  GetProposalCustomerRequestsResult,
  UpdateProposalCustomerRequestStatusAppResult,
} from "@/app/lib/proposalCustomerRequestReview";

export async function getProposalCustomerRequestsForAuthenticatedContractor(
  input: GetProposalCustomerRequestsInput
): Promise<GetProposalCustomerRequestsResult> {
  const supabase = await createClient();

  return getProposalCustomerRequestsForContractor(input, {
    getProposal: (companyId, proposalId) =>
      getProposalById(companyId, proposalId, {
        getSupabase: () => supabase,
      }),
    listRequests: (listInput) =>
      listProposalCustomerRequestsForProposalWithClient(supabase, listInput),
  });
}

export async function updateProposalCustomerRequestStatusForAuthenticatedContractor(
  input: Omit<UpdateProposalCustomerRequestStatusInput, "status"> & {
    status: ProposalCustomerRequestReviewStatus;
  }
): Promise<UpdateProposalCustomerRequestStatusAppResult> {
  const supabase = await createClient();

  return updateProposalCustomerRequestStatusForContractor(input, {
    getProposal: (companyId, proposalId) =>
      getProposalById(companyId, proposalId, {
        getSupabase: () => supabase,
      }),
    listRequests: (listInput) =>
      listProposalCustomerRequestsForProposalWithClient(supabase, listInput),
    updateStatus: (updateInput) =>
      updateProposalCustomerRequestStatusViaRpc(supabase, updateInput),
  });
}
