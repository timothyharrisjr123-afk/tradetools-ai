/**
 * R18C4C — Injectable public proposal review link mint orchestration.
 *
 * Server entry wires default deps in proposalPublicReviewLink.server.ts.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import type { ProposalPublicAccessMintRequest } from "@/app/lib/proposalPublicAccessTokenMintPersistence";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";
import {
  buildPublicProposalReviewUrl,
  PUBLIC_REVIEW_MINT_ERROR_MESSAGE,
  resolvePublicProposalSnapshotVersionId,
} from "@/app/lib/proposalPublicReviewReadiness";

export const PUBLIC_REVIEW_LINK_MINT_METADATA = {
  source: "contractor_preview_qa",
} as const;

export const PUBLIC_REVIEW_LINK_EXPIRY_DAYS = 30;

export type CreatePublicProposalReviewLinkInput = {
  companyId: string;
  proposalId: string;
  jobId: string;
  userId: string;
  origin: string;
};

export type CreatePublicProposalReviewLinkSuccess = {
  ok: true;
  publicUrl: string;
  tokenPrefix: string;
  expiresAt: string;
};

export type CreatePublicProposalReviewLinkFailure = {
  ok: false;
  message: string;
};

export type CreatePublicProposalReviewLinkResult =
  | CreatePublicProposalReviewLinkSuccess
  | CreatePublicProposalReviewLinkFailure;

export type ProposalPublicReviewMintResult =
  | {
      ok: true;
      raw_token: string;
      token_prefix: string;
      expires_at: string;
    }
  | { ok: false; code: string };

export type ProposalPublicReviewLinkDeps = {
  getProposal: (companyId: string, proposalId: string) => Promise<ProposalRecord | null>;
  mintToken: (input: ProposalPublicAccessMintRequest) => Promise<ProposalPublicReviewMintResult>;
  now?: () => Date;
};

function failure(message: string): CreatePublicProposalReviewLinkFailure {
  return { ok: false, message };
}

export function buildPublicReviewLinkExpiresAt(now: Date = new Date()): string {
  const expires = new Date(now.getTime());
  expires.setUTCDate(expires.getUTCDate() + PUBLIC_REVIEW_LINK_EXPIRY_DAYS);
  return expires.toISOString();
}

export async function createPublicProposalReviewLink(
  input: CreatePublicProposalReviewLinkInput,
  deps: ProposalPublicReviewLinkDeps
): Promise<CreatePublicProposalReviewLinkResult> {
  const companyId = input.companyId.trim();
  const proposalId = input.proposalId.trim();
  const jobId = input.jobId.trim();
  const userId = input.userId.trim();
  const origin = input.origin.trim();

  if (!isUuidLike(companyId) || !isUuidLike(proposalId) || !isUuidLike(jobId) || userId.length === 0) {
    return failure(PUBLIC_REVIEW_MINT_ERROR_MESSAGE);
  }

  if (origin.length === 0) {
    return failure(PUBLIC_REVIEW_MINT_ERROR_MESSAGE);
  }

  const proposal = await deps.getProposal(companyId, proposalId);
  if (!proposal) {
    return failure(PUBLIC_REVIEW_MINT_ERROR_MESSAGE);
  }

  if ((proposal.job_id ?? "").trim() !== jobId) {
    return failure(PUBLIC_REVIEW_MINT_ERROR_MESSAGE);
  }

  const snapshotVersionId = resolvePublicProposalSnapshotVersionId(proposal);
  if (!snapshotVersionId) {
    return failure(PUBLIC_REVIEW_MINT_ERROR_MESSAGE);
  }

  const mintResult = await deps.mintToken({
    company_id: companyId,
    proposal_id: proposalId,
    proposal_version_id: snapshotVersionId,
    expires_at: buildPublicReviewLinkExpiresAt(deps.now?.()),
    metadata_json: { ...PUBLIC_REVIEW_LINK_MINT_METADATA },
    created_by: userId,
  });

  if (!mintResult.ok) {
    return failure(PUBLIC_REVIEW_MINT_ERROR_MESSAGE);
  }

  const publicUrl = buildPublicProposalReviewUrl(origin, mintResult.raw_token);

  return {
    ok: true,
    publicUrl,
    tokenPrefix: mintResult.token_prefix,
    expiresAt: mintResult.expires_at,
  };
}
