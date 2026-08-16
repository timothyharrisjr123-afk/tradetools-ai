/**
 * R3C — Server-only public acceptance RPC entry.
 */

import "server-only";

import {
  recordProposalAcceptanceViaRpc,
  type ProposalAcceptanceRecordResult,
  type ProposalAcceptanceSubmitInput,
} from "@/app/lib/proposalAcceptancePersistence";
import { createAdminClient } from "@/app/lib/supabase/admin";

export async function recordProposalAcceptance(
  rawToken: string,
  input: ProposalAcceptanceSubmitInput = {}
): Promise<ProposalAcceptanceRecordResult> {
  return recordProposalAcceptanceViaRpc(createAdminClient(), rawToken, input);
}
