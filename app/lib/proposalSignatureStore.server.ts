/**
 * R3D — Server-only public signature RPC entry.
 */

import "server-only";

import {
  recordProposalSignatureViaRpc,
  type ProposalSignatureRecordResult,
  type ProposalSignatureSubmitInput,
} from "@/app/lib/proposalSignaturePersistence";
import { createAdminClient } from "@/app/lib/supabase/admin";

export async function recordProposalSignature(
  rawToken: string,
  input: ProposalSignatureSubmitInput
): Promise<ProposalSignatureRecordResult> {
  return recordProposalSignatureViaRpc(createAdminClient(), rawToken, input);
}
