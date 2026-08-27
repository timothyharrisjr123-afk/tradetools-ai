/**
 * 052 — Server-only public package choice RPC entry.
 */

import "server-only";

import {
  recordProposalPublicOptionChoiceViaRpc,
  type ProposalPublicOptionChoiceRecordResult,
} from "@/app/lib/proposalPublicOptionChoicePersistence";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type {
  ProposalPublicOptionChoiceFailureCode,
  ProposalPublicOptionChoiceRecordFailure,
  ProposalPublicOptionChoiceRecordResult,
  ProposalPublicOptionChoiceRecordSuccess,
} from "@/app/lib/proposalPublicOptionChoicePersistence";

export {
  PROPOSAL_PUBLIC_OPTION_CHOICE_FAILURE_CODES,
  PROPOSAL_PUBLIC_OPTION_CHOICE_KEY_MAX,
  ProposalPublicOptionChoicePersistenceError,
  ProposalPublicOptionChoiceValidationError,
  RECORD_PROPOSAL_PUBLIC_OPTION_CHOICE_RPC_V1,
} from "@/app/lib/proposalPublicOptionChoicePersistence";

export async function recordProposalPublicOptionChoice(
  rawToken: string,
  optionKey: string
): Promise<ProposalPublicOptionChoiceRecordResult> {
  return recordProposalPublicOptionChoiceViaRpc(createAdminClient(), rawToken, optionKey);
}
