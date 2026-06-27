/**
 * R18C4C — Server-only entry for contractor public proposal review link minting.
 */

import "server-only";

import { adaptProposalDraftGraphToBuilderPreview } from "@/app/lib/proposalDraftGraphAdapter";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import { buildProposalSendSnapshotServerDeps } from "@/app/lib/proposalIdentityEcho.server";
import {
  createPublicProposalReviewLink,
  type CreatePublicProposalReviewLinkInput,
  type CreatePublicProposalReviewLinkResult,
} from "@/app/lib/proposalPublicReviewLink";
import { mintProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMintStore.server";
import { getDraftGraph } from "@/app/lib/proposalRecordStore";
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
    const measurement = await getSelectedMeasurementForJob(input.jobId, supabase);
    const adapter = adaptProposalDraftGraphToBuilderPreview(graph);
    pricingStale = deriveProposalPricingStale({
      snapshotMeasurementId: adapter.snapshotMeasurementRecordId,
      currentMeasurementId: measurement?.id ?? null,
      snapshotUpdatedAt: graph.proposal.updated_at,
      measurementUpdatedAt: measurement?.updated_at ?? null,
    }).stale;
  }

  return createPublicProposalReviewLink(input, {
    ...buildProposalSendSnapshotServerDeps(supabase),
    mintToken: mintProposalPublicAccessToken,
    pricingStale,
  });
}
