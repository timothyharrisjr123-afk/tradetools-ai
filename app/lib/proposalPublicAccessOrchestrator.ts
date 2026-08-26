/**
 * R18C4A — Public proposal access orchestrator (injectable composition).
 *
 * Server entry wires default deps in proposalPublicAccessOrchestrator.server.ts.
 */

import { buildProposalPublicGraphDto, type ProposalPublicGraphInput } from "@/app/lib/proposalPublicGraphDto";
import type { ProposalPublicAccessCustomerViewMetadata } from "@/app/lib/proposalPublicAccessRpcPersistence";
import type {
  ProposalPublicAccessFailureCode,
  ProposalPublicAccessRecordViewResult,
  ProposalPublicAccessResolveResult,
} from "@/app/lib/proposalPublicAccessRpcPersistence";
import { ProposalPublicAccessTokenHashError } from "@/app/lib/proposalPublicAccessTokenHash";
import {
  buildProposalPublicProposalDocumentViewModel,
  buildProposalPublicProposalErrorViewModel,
  type ProposalPublicProposalDocumentViewModel,
  type ProposalPublicProposalErrorCode,
  type ProposalPublicProposalErrorViewModel,
} from "@/app/lib/proposalPublicProposalViewModel";
import { formatProposalCustomerAcceptedOnLabel } from "@/app/lib/proposalCustomerPacketViewModel";
import { resolveSelectedTemplateOptionIdFromGraph } from "@/app/lib/proposalDraftGraphAdapter";
import {
  ProposalRecordStoreError,
  type ProposalDraftGraph,
  type ProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";

export type ProposalPublicViewTrackingEnvelope = {
  token_id: string;
  proposal_id: string;
  proposal_version_id: string;
  company_id: string;
  view_recorded: boolean;
  view_event_type: "first_view" | "view" | null;
};

export type LoadPublicProposalByTokenSuccess = {
  ok: true;
  document: ProposalPublicProposalDocumentViewModel;
  tracking: ProposalPublicViewTrackingEnvelope;
};

export type LoadPublicProposalByTokenFailure = {
  ok: false;
  error: ProposalPublicProposalErrorViewModel;
};

export type LoadPublicProposalByTokenResult =
  | LoadPublicProposalByTokenSuccess
  | LoadPublicProposalByTokenFailure;

export type ProposalPublicAccessOrchestratorDeps = {
  resolveToken: (rawToken: string) => Promise<ProposalPublicAccessResolveResult>;
  getVersionGraph: (
    companyId: string,
    proposalId: string,
    versionId: string,
    options: { requireSentVersion: true }
  ) => Promise<ProposalVersionGraph | null>;
  buildDto: typeof buildProposalPublicGraphDto;
  buildDocumentViewModel: typeof buildProposalPublicProposalDocumentViewModel;
  recordView: (
    rawToken: string,
    metadata?: ProposalPublicAccessCustomerViewMetadata
  ) => Promise<ProposalPublicAccessRecordViewResult>;
  getAcceptanceForToken?: (input: {
    companyId: string;
    tokenId: string;
    proposalId: string;
    proposalVersionId: string;
  }) => Promise<{
    id?: string;
    acceptedAt: string;
    signedAt?: string | null;
    signerPrintedName?: string | null;
  } | null>;
};

function isSentOrSignedVersionKind(kind: string): kind is "sent" | "signed" {
  return kind === "sent" || kind === "signed";
}

function mapResolveFailureCode(code: ProposalPublicAccessFailureCode): ProposalPublicProposalErrorCode {
  switch (code) {
    case "invalid_hash":
    case "not_found":
      return "invalid_token";
    case "expired":
      return "expired_token";
    case "revoked":
      return "revoked_token";
    case "superseded":
      return "superseded_token";
    case "invalid_version":
    case "invalid_binding":
      return "proposal_unavailable";
    default:
      return "internal_error";
  }
}

function failure(code: ProposalPublicProposalErrorCode): LoadPublicProposalByTokenFailure {
  return {
    ok: false,
    error: buildProposalPublicProposalErrorViewModel(code),
  };
}

function assertUsableRawPublicAccessToken(rawToken: unknown): asserts rawToken is string {
  if (typeof rawToken !== "string") {
    throw new ProposalPublicAccessTokenHashError(
      "Public access token must be a non-empty string."
    );
  }
  if (rawToken.trim().length === 0) {
    throw new ProposalPublicAccessTokenHashError(
      "Public access token must not be empty or whitespace-only."
    );
  }
}

function resolveVersionKind(graph: ProposalVersionGraph): "sent" | "signed" {
  const kind = graph.version.version_kind;
  return isSentOrSignedVersionKind(kind) ? kind : "sent";
}

export async function loadPublicProposalByToken(
  rawToken: string,
  viewMetadata: ProposalPublicAccessCustomerViewMetadata = {},
  deps: ProposalPublicAccessOrchestratorDeps
): Promise<LoadPublicProposalByTokenResult> {
  try {
    assertUsableRawPublicAccessToken(rawToken);
  } catch {
    return failure("invalid_token");
  }

  const resolveResult = await deps.resolveToken(rawToken);
  if (!resolveResult.ok) {
    return failure(mapResolveFailureCode(resolveResult.code));
  }

  let graph: ProposalVersionGraph | null;
  try {
    graph = await deps.getVersionGraph(
      resolveResult.company_id,
      resolveResult.proposal_id,
      resolveResult.proposal_version_id,
      { requireSentVersion: true }
    );
  } catch (error) {
    if (error instanceof ProposalRecordStoreError) {
      return failure("graph_unavailable");
    }
    return failure("internal_error");
  }

  if (!graph) {
    return failure("graph_unavailable");
  }

  let document: ProposalPublicProposalDocumentViewModel;
  try {
    const selectedTemplateOptionId = resolveSelectedTemplateOptionIdFromGraph(
      graph as unknown as ProposalDraftGraph
    );
    const dto = deps.buildDto(graph as ProposalPublicGraphInput, selectedTemplateOptionId);
    document = deps.buildDocumentViewModel(dto, { versionKind: resolveVersionKind(graph) });
  } catch {
    return failure("internal_error");
  }

  const recordResult = await deps.recordView(rawToken, viewMetadata);
  if (!recordResult.ok) {
    return failure("internal_error");
  }

  try {
    const acceptance = deps.getAcceptanceForToken
      ? await deps.getAcceptanceForToken({
          companyId: resolveResult.company_id,
          tokenId: resolveResult.token_id,
          proposalId: resolveResult.proposal_id,
          proposalVersionId: resolveResult.proposal_version_id,
        })
      : null;
    if (acceptance?.acceptedAt) {
      const signedAt = (acceptance.signedAt ?? "").trim();
      const signerDisplayName = (acceptance.signerPrintedName ?? "").trim() || null;
      document = {
        ...document,
        packet: {
          ...document.packet,
          acceptance: {
            status: signedAt ? "signed" : "accepted",
            acceptedOnLabel: formatProposalCustomerAcceptedOnLabel(
              acceptance.acceptedAt
            ),
            signedOnLabel: signedAt
              ? formatProposalCustomerAcceptedOnLabel(signedAt)
              : null,
            signerDisplayName,
          },
        },
      };
    }
  } catch {
    // Public document still renders if acceptance lookup fails.
  }

  return {
    ok: true,
    document,
    tracking: {
      token_id: resolveResult.token_id,
      proposal_id: resolveResult.proposal_id,
      proposal_version_id: resolveResult.proposal_version_id,
      company_id: resolveResult.company_id,
      view_recorded: true,
      view_event_type: recordResult.event_type,
    },
  };
}