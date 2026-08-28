/**
 * Stage 2C — Copy payment link for the canonical accepted proposal version.
 *
 * Does NOT use createPublicProposalReviewLinkForContractor (send-prep / freeze).
 * Mints an existing customer_view token for the latest acceptance version only.
 */

import "server-only";

import { mintProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMintStore.server";
import {
  buildPublicProposalReviewUrl,
  PUBLIC_REVIEW_MINT_ERROR_MESSAGE,
} from "@/app/lib/proposalPublicReviewReadiness";
import { buildPublicReviewLinkExpiresAt } from "@/app/lib/proposalPublicReviewLink";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const PAYMENT_COPY_LINK_MINT_METADATA = {
  source: "contractor_preview_qa",
} as const;

export type CreateAcceptedPaymentPublicLinkInput = {
  companyId: string;
  jobId: string;
  userId: string;
  origin: string;
};

export type CreateAcceptedPaymentPublicLinkResult =
  | {
      ok: true;
      publicUrl: string;
      tokenPrefix: string;
      expiresAt: string;
      proposalId: string;
      proposalVersionId: string;
    }
  | { ok: false; code: string; message: string };

export async function createAcceptedPaymentPublicLink(
  input: CreateAcceptedPaymentPublicLinkInput
): Promise<CreateAcceptedPaymentPublicLinkResult> {
  const companyId = input.companyId.trim();
  const jobId = input.jobId.trim();
  const userId = input.userId.trim();
  const origin = input.origin.trim().replace(/\/$/, "");

  if (!isUuidLike(companyId) || !isUuidLike(jobId) || userId.length === 0 || origin.length === 0) {
    return { ok: false, code: "invalid_payload", message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE };
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!job) {
    return { ok: false, code: "not_found", message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE };
  }

  const { data: acceptance } = await supabase
    .from("proposal_acceptances")
    .select("proposal_id,proposal_version_id")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const proposalId = String(acceptance?.proposal_id ?? "").trim();
  const proposalVersionId = String(acceptance?.proposal_version_id ?? "").trim();
  if (!isUuidLike(proposalId) || !isUuidLike(proposalVersionId)) {
    return { ok: false, code: "no_acceptance", message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE };
  }

  const mintResult = await mintProposalPublicAccessToken({
    company_id: companyId,
    proposal_id: proposalId,
    proposal_version_id: proposalVersionId,
    expires_at: buildPublicReviewLinkExpiresAt(),
    metadata_json: { ...PAYMENT_COPY_LINK_MINT_METADATA },
    created_by: userId,
  });

  if (!mintResult.ok) {
    return {
      ok: false,
      code: mintResult.code ?? "mint_failed",
      message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE,
    };
  }

  return {
    ok: true,
    publicUrl: buildPublicProposalReviewUrl(origin, mintResult.raw_token),
    tokenPrefix: mintResult.token_prefix,
    expiresAt: mintResult.expires_at,
    proposalId,
    proposalVersionId,
  };
}
