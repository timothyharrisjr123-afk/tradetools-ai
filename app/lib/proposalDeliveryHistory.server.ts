/**
 * R18D3C2 — Server-only contractor delivery history read wiring.
 */

import "server-only";

import { listProposalDeliveryAttemptsForProposalWithClient } from "@/app/lib/proposalDeliveryAttemptPersistence";
import {
  getProposalDeliveryHistory,
  type GetProposalDeliveryHistoryInput,
  type GetProposalDeliveryHistoryResult,
} from "@/app/lib/proposalDeliveryHistory";
import { getProposalById } from "@/app/lib/proposalRecordStore";
import { createClient } from "@/app/lib/supabase/server";

export type {
  GetProposalDeliveryHistoryInput,
  GetProposalDeliveryHistoryResult,
} from "@/app/lib/proposalDeliveryHistory";

export async function getProposalDeliveryHistoryForContractor(
  input: GetProposalDeliveryHistoryInput
): Promise<GetProposalDeliveryHistoryResult> {
  const supabase = await createClient();

  return getProposalDeliveryHistory(input, {
    getProposal: (companyId, proposalId) =>
      getProposalById(companyId, proposalId, {
        getSupabase: () => supabase,
      }),
    listDeliveryAttempts: (listInput) =>
      listProposalDeliveryAttemptsForProposalWithClient(supabase, listInput),
  });
}
