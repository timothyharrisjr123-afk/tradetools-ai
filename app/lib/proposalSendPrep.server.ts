/**
 * R18D2 — Server-only entry for contractor customer send link prep.
 */

import "server-only";

import { adaptProposalDraftGraphToBuilderPreview } from "@/app/lib/proposalDraftGraphAdapter";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import {
  prepareProposalCustomerSendLink,
  type PrepareProposalCustomerSendLinkInput,
  type PrepareProposalCustomerSendLinkResult,
} from "@/app/lib/proposalSendPrep";
import { isProposalSendFreezeRpcEnabled } from "@/app/lib/proposalSendFreezeRpcPersistence";
import { mintProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMintStore.server";
import {
  freezeDraftToSentSnapshot,
  getDraftGraph,
  getProposalById,
  getProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";
import { createClient } from "@/app/lib/supabase/server";

export type {
  PrepareProposalCustomerSendLinkInput,
  PrepareProposalCustomerSendLinkResult,
} from "@/app/lib/proposalSendPrep";

export async function prepareProposalCustomerSendLinkForContractor(
  input: PrepareProposalCustomerSendLinkInput
): Promise<PrepareProposalCustomerSendLinkResult> {
  const supabase = await createClient();

  let pricingStale = input.pricingStale === true;
  if (input.pricingStale == null) {
    const graph = await getDraftGraph(input.companyId, input.proposalId, {
      getSupabase: () => supabase,
    });
    if (graph) {
      const measurement = await getSelectedMeasurementForJob(input.jobId);
      const adapter = adaptProposalDraftGraphToBuilderPreview(graph);
      pricingStale = deriveProposalPricingStale({
        snapshotMeasurementId: adapter.snapshotMeasurementRecordId,
        currentMeasurementId: measurement?.id ?? null,
        snapshotUpdatedAt: graph.proposal.updated_at,
        measurementUpdatedAt: measurement?.updated_at ?? null,
      }).stale;
    }
  }

  return prepareProposalCustomerSendLink(
    { ...input, pricingStale },
    {
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
      mintToken: mintProposalPublicAccessToken,
      isFreezeEnabled: isProposalSendFreezeRpcEnabled,
    }
  );
}
