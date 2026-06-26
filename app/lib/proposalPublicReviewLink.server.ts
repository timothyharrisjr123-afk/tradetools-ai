/**
 * R18C4C — Server-only entry for contractor public proposal review link minting.
 */

import "server-only";

import { adaptProposalDraftGraphToBuilderPreview } from "@/app/lib/proposalDraftGraphAdapter";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import {
  createPublicProposalReviewLink,
  type CreatePublicProposalReviewLinkInput,
  type CreatePublicProposalReviewLinkResult,
} from "@/app/lib/proposalPublicReviewLink";
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
  CreatePublicProposalReviewLinkInput,
  CreatePublicProposalReviewLinkResult,
} from "@/app/lib/proposalPublicReviewLink";

export async function createPublicProposalReviewLinkForContractor(
  input: CreatePublicProposalReviewLinkInput
): Promise<CreatePublicProposalReviewLinkResult> {
  const supabase = await createClient();

  let pricingStale = false;
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

  return createPublicProposalReviewLink(input, {
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
    pricingStale,
  });
}
