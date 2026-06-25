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
import { getPublicProposalVersionGraph } from "@/app/lib/proposalVersionGraphStore.server";

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
  };

  return loadPublicProposalByTokenCore(rawToken, viewMetadata, mergedDeps);
}
