/**
 * R18C4A — Server-only entry for public proposal access orchestrator.
 */

import "server-only";

import {
  loadPublicProposalByToken as loadPublicProposalByTokenCore,
  type LoadPublicProposalByTokenFailure,
  type LoadPublicProposalByTokenResult,
  type LoadPublicProposalByTokenSuccess,
  type ProposalPublicAccessOrchestratorDeps,
  type ProposalPublicViewTrackingEnvelope,
} from "@/app/lib/proposalPublicAccessOrchestrator";
import type { ProposalPublicAccessCustomerViewMetadata } from "@/app/lib/proposalPublicAccessRpcPersistence";
import {
  recordProposalCustomerView,
  resolveProposalPublicAccessToken,
} from "@/app/lib/proposalPublicAccessRpcStore.server";
import { buildProposalPublicGraphDto } from "@/app/lib/proposalPublicGraphDto";
import { buildProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getPublicProposalVersionGraph } from "@/app/lib/proposalVersionGraphStore.server";

async function getAcceptanceForToken(input: {
  companyId: string;
  tokenId: string;
  proposalId: string;
  proposalVersionId: string;
}): Promise<{
  acceptedAt: string;
  signedAt?: string | null;
  signerPrintedName?: string | null;
} | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("proposal_acceptances")
      .select("id,accepted_at")
      .eq("company_id", input.companyId)
      .eq("proposal_id", input.proposalId)
      .eq("proposal_version_id", input.proposalVersionId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.accepted_at) return null;
    const acceptedAt = String(data.accepted_at);
    const acceptanceId = String(data.id ?? "").trim();
    if (!acceptanceId) return { acceptedAt };
    const { data: signature, error: signatureError } = await supabase
      .from("proposal_signatures")
      .select("signed_at,signer_printed_name")
      .eq("company_id", input.companyId)
      .eq("proposal_acceptance_id", acceptanceId)
      .eq("signer_slot", "customer_primary")
      .maybeSingle();
    if (signatureError || !signature?.signed_at) {
      return { acceptedAt };
    }
    return {
      acceptedAt,
      signedAt: String(signature.signed_at),
      signerPrintedName: signature.signer_printed_name
        ? String(signature.signer_printed_name)
        : null,
    };
  } catch {
    return null;
  }
}

export type {
  LoadPublicProposalByTokenFailure,
  LoadPublicProposalByTokenResult,
  LoadPublicProposalByTokenSuccess,
  ProposalPublicAccessOrchestratorDeps,
  ProposalPublicViewTrackingEnvelope,
};

export async function loadPublicProposalByToken(
  rawToken: string,
  viewMetadata: ProposalPublicAccessCustomerViewMetadata = {},
  deps?: Partial<ProposalPublicAccessOrchestratorDeps>
): Promise<LoadPublicProposalByTokenResult> {
  const mergedDeps: ProposalPublicAccessOrchestratorDeps = {
    resolveToken: deps?.resolveToken ?? resolveProposalPublicAccessToken,
    getVersionGraph: deps?.getVersionGraph ?? getPublicProposalVersionGraph,
    buildDto: deps?.buildDto ?? buildProposalPublicGraphDto,
    buildDocumentViewModel: deps?.buildDocumentViewModel ?? buildProposalPublicProposalDocumentViewModel,
    recordView: deps?.recordView ?? recordProposalCustomerView,
    getAcceptanceForToken: deps?.getAcceptanceForToken ?? getAcceptanceForToken,
  };

  return loadPublicProposalByTokenCore(rawToken, viewMetadata, mergedDeps);
}
