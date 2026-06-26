/**
 * R18D3A — Server-only entry points for proposal delivery attempt persistence.
 */

import "server-only";

import {
  createProposalDeliveryAttemptedWithClient,
  listProposalDeliveryAttemptsForProposalWithClient,
  markProposalDeliveryAttemptFailedWithClient,
  markProposalDeliveryAttemptProviderAcceptedWithClient,
} from "@/app/lib/proposalDeliveryAttemptPersistence";
import type {
  CreateProposalDeliveryAttemptInput,
  ListProposalDeliveryAttemptsInput,
  MarkProposalDeliveryAttemptFailedInput,
  MarkProposalDeliveryAttemptProviderAcceptedInput,
  ProposalDeliveryAttemptRow,
} from "@/app/lib/proposalDeliveryAttemptTypes";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type ProposalDeliveryAttemptStoreDeps = {
  getSupabase?: () => ReturnType<typeof createAdminClient>;
  now?: () => Date;
};

export type {
  CreateProposalDeliveryAttemptInput,
  ListProposalDeliveryAttemptsInput,
  MarkProposalDeliveryAttemptFailedInput,
  MarkProposalDeliveryAttemptProviderAcceptedInput,
  ProposalDeliveryAttemptRow,
} from "@/app/lib/proposalDeliveryAttemptTypes";

export {
  ProposalDeliveryAttemptPersistenceError,
  truncateSafeDeliveryErrorMessage,
} from "@/app/lib/proposalDeliveryAttemptPersistence";

function resolveSupabase(deps?: ProposalDeliveryAttemptStoreDeps) {
  return deps?.getSupabase?.() ?? createAdminClient();
}

export async function createProposalDeliveryAttempted(
  input: CreateProposalDeliveryAttemptInput,
  deps?: ProposalDeliveryAttemptStoreDeps
): Promise<ProposalDeliveryAttemptRow> {
  return createProposalDeliveryAttemptedWithClient(resolveSupabase(deps), input, deps?.now);
}

export async function markProposalDeliveryAttemptProviderAccepted(
  input: MarkProposalDeliveryAttemptProviderAcceptedInput,
  deps?: ProposalDeliveryAttemptStoreDeps
): Promise<ProposalDeliveryAttemptRow> {
  return markProposalDeliveryAttemptProviderAcceptedWithClient(
    resolveSupabase(deps),
    input,
    deps?.now
  );
}

export async function markProposalDeliveryAttemptFailed(
  input: MarkProposalDeliveryAttemptFailedInput,
  deps?: ProposalDeliveryAttemptStoreDeps
): Promise<ProposalDeliveryAttemptRow> {
  return markProposalDeliveryAttemptFailedWithClient(resolveSupabase(deps), input, deps?.now);
}

export async function listProposalDeliveryAttemptsForProposal(
  input: ListProposalDeliveryAttemptsInput,
  deps?: ProposalDeliveryAttemptStoreDeps
): Promise<ProposalDeliveryAttemptRow[]> {
  return listProposalDeliveryAttemptsForProposalWithClient(resolveSupabase(deps), input);
}
