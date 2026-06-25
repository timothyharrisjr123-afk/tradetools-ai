/**
 * R18C4C — Server-only entry for contractor public proposal review link minting.
 */

import "server-only";

import {
  createPublicProposalReviewLink,
  type CreatePublicProposalReviewLinkInput,
  type CreatePublicProposalReviewLinkResult,
} from "@/app/lib/proposalPublicReviewLink";
import { mintProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMintStore.server";
import { getProposalById } from "@/app/lib/proposalRecordStore";
import { createClient } from "@/app/lib/supabase/server";

export type {
  CreatePublicProposalReviewLinkInput,
  CreatePublicProposalReviewLinkResult,
} from "@/app/lib/proposalPublicReviewLink";

export async function createPublicProposalReviewLinkForContractor(
  input: CreatePublicProposalReviewLinkInput
): Promise<CreatePublicProposalReviewLinkResult> {
  const supabase = await createClient();

  return createPublicProposalReviewLink(input, {
    getProposal: (companyId, proposalId) =>
      getProposalById(companyId, proposalId, {
        getSupabase: () => supabase,
      }),
    mintToken: mintProposalPublicAccessToken,
  });
}
