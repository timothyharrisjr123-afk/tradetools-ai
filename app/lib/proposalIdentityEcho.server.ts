/**
 * Proposal identity echo — server wiring for send/review-link prep (Stage B).
 */

import "server-only";

import {
  ensureProposalIdentityEchoFreshBeforeSendPrep,
  type EnsureProposalIdentityEchoFreshResult,
} from "@/app/lib/proposalIdentityEchoLive";
import {
  freezeDraftToSentSnapshot,
  getDraftGraph,
  getProposalById,
  getProposalVersionGraph,
  restampDraftProposalIdentityEcho,
  type RestampDraftProposalIdentityEchoInput,
} from "@/app/lib/proposalRecordStore";
import { isProposalSendFreezeRpcEnabled } from "@/app/lib/proposalSendFreezeRpcPersistence";
import type { ResolveProposalSendSnapshotDeps } from "@/app/lib/proposalSendPrep";
import type { getSupabaseClient } from "@/app/lib/supabaseClient";

export {
  buildLiveProposalIdentityEchoForDraftProposal,
  loadLiveProposalIdentityEchoForDraftProposal,
} from "@/app/lib/proposalRecordStore";
export {
  composeLiveProposalIdentityEchoFromSources,
  ensureProposalIdentityEchoFreshBeforeSendPrep,
} from "@/app/lib/proposalIdentityEchoLive";

export type ProposalSendSnapshotServerSupabase = NonNullable<
  ReturnType<typeof getSupabaseClient>
>;

export function buildEnsureProposalIdentityEchoFreshForSendPrep(
  supabase: ProposalSendSnapshotServerSupabase
): NonNullable<ResolveProposalSendSnapshotDeps["ensureProposalIdentityEchoFresh"]> {
  return async (input) => {
    const result: EnsureProposalIdentityEchoFreshResult =
      await ensureProposalIdentityEchoFreshBeforeSendPrep(input, {
        restampDraftProposalIdentityEcho: (companyId, proposalId, restampInput?: RestampDraftProposalIdentityEchoInput) =>
          restampDraftProposalIdentityEcho(
            companyId,
            proposalId,
            { ...restampInput, jobId: restampInput?.jobId ?? input.jobId },
            { getSupabase: () => supabase }
          ),
      });

    return {
      identityRestamped: result.identityRestamped,
      changedFields: result.changedFields,
    };
  };
}

export function buildProposalSendSnapshotServerDeps(
  supabase: ProposalSendSnapshotServerSupabase
): ResolveProposalSendSnapshotDeps {
  return {
    getProposal: (companyId, proposalId) =>
      getProposalById(companyId, proposalId, {
        getSupabase: () => supabase,
      }),
    getDraftGraph: (companyId, proposalId) =>
      getDraftGraph(companyId, proposalId, {
        getSupabase: () => supabase,
      }),
    getSentVersionFrozenAt: async (companyId, proposalId, versionId) => {
      const versionGraph = await getProposalVersionGraph(
        companyId,
        proposalId,
        versionId,
        {},
        { getSupabase: () => supabase }
      );
      return versionGraph?.version.frozen_at ?? null;
    },
    freezeDraft: async ({ companyId, proposalId, pricingStale: stale }) => {
      const result = await freezeDraftToSentSnapshot(
        companyId,
        proposalId,
        { pricingStale: stale },
        { getSupabase: () => supabase }
      );
      return { sentVersionId: result.sentVersionId };
    },
    isFreezeEnabled: isProposalSendFreezeRpcEnabled,
    ensureProposalIdentityEchoFresh: buildEnsureProposalIdentityEchoFreshForSendPrep(supabase),
  };
}
