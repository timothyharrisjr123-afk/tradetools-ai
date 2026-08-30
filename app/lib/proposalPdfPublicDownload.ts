/**
 * Customer / public Proposal PDF download orchestration.
 * Authority is the raw public access token → exact bound proposal_version_id.
 * Browser never supplies version/proposal/artifact as authority.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  contractorProposalPdfResponseHeaders,
  generateContractorProposalPdf,
  loadContractorProposalPdfSignatureOverlay,
  type ContractorProposalPdfDeps,
  type ContractorProposalPdfResult,
} from "@/app/lib/proposalPdfContractorDownload";
import { renderProposalPdf } from "@/app/lib/proposalPdfRender";
import {
  PROPOSAL_PDF_ARTIFACT_SENT,
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
  type ProposalPdfArtifactType,
  type ProposalPdfSignatureOverlay,
} from "@/app/lib/proposalPdfTypes";
import { readProposalPaymentTerms } from "@/app/lib/proposalPaymentTermsPersistence";
import type {
  ProposalPublicAccessFailureCode,
  ProposalPublicAccessResolveResult,
} from "@/app/lib/proposalPublicAccessRpcPersistence";
import {
  ProposalRecordStoreError,
  type ProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";

export const CUSTOMER_PDF_DOWNLOAD_LABEL = "Download PDF" as const;
export const CUSTOMER_PDF_PREPARING_LABEL = "Preparing PDF…" as const;
export const CUSTOMER_PDF_UNAVAILABLE_MESSAGE = "PDF unavailable. Try again." as const;

/** Opaque customer-facing failure — never disclose token/version reason. */
export type PublicProposalPdfFailureCode = "unavailable" | "generation_failed";

export type PublicProposalPdfSuccess = {
  ok: true;
  bytes: Uint8Array;
  filename: string;
  artifactType: ProposalPdfArtifactType;
  proposalVersionId: string;
  pageCount: number;
};

export type PublicProposalPdfFailure = {
  ok: false;
  code: PublicProposalPdfFailureCode;
};

export type PublicProposalPdfResult =
  | PublicProposalPdfSuccess
  | PublicProposalPdfFailure;

export type PublicProposalPdfDeps = {
  resolveToken: (rawToken: string) => Promise<ProposalPublicAccessResolveResult>;
  getVersionGraph: (
    companyId: string,
    proposalId: string,
    versionId: string,
    options: { requireSentVersion: true }
  ) => Promise<ProposalVersionGraph | null>;
  loadSignatureOverlay: (input: {
    companyId: string;
    proposalId: string;
    proposalVersionId: string;
  }) => Promise<ProposalPdfSignatureOverlay | null>;
  readPaymentTerms: ContractorProposalPdfDeps["readPaymentTerms"];
  render: typeof renderProposalPdf;
};

const TOKEN_ACCESS_FAILURES = new Set<ProposalPublicAccessFailureCode>([
  "invalid_hash",
  "not_found",
  "revoked",
  "superseded",
  "expired",
  "invalid_version",
  "invalid_binding",
]);

function isBlankToken(rawToken: unknown): boolean {
  return typeof rawToken !== "string" || rawToken.trim().length === 0;
}

/**
 * Customer convenience: one artifact.
 * Signed-final only when exact token-bound version has acceptance/signature truth.
 */
export function selectCustomerProposalPdfArtifactType(
  signatureOverlay: ProposalPdfSignatureOverlay | null
): ProposalPdfArtifactType {
  return signatureOverlay
    ? PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL
    : PROPOSAL_PDF_ARTIFACT_SENT;
}

export function publicProposalPdfHttpStatus(
  code: PublicProposalPdfFailureCode
): number {
  return code === "generation_failed" ? 500 : 404;
}

export function publicProposalPdfResponseHeaders(filename: string): HeadersInit {
  return contractorProposalPdfResponseHeaders(filename);
}

export function buildPublicProposalPdfHref(rawToken: string): string {
  return `/api/proposals/public/${encodeURIComponent(rawToken.trim())}/pdf`;
}

/**
 * Generate the customer PDF for a raw public access token.
 * Resolves token server-side; never trusts client version/proposal/artifact.
 * Does not record a customer view (PDF is read-only side-channel).
 */
export async function generatePublicProposalPdf(input: {
  rawToken: string;
  deps: PublicProposalPdfDeps;
}): Promise<PublicProposalPdfResult> {
  if (isBlankToken(input.rawToken)) {
    return { ok: false, code: "unavailable" };
  }

  let resolveResult: ProposalPublicAccessResolveResult;
  try {
    resolveResult = await input.deps.resolveToken(input.rawToken);
  } catch {
    return { ok: false, code: "unavailable" };
  }

  if (!resolveResult.ok) {
    if (TOKEN_ACCESS_FAILURES.has(resolveResult.code)) {
      return { ok: false, code: "unavailable" };
    }
    return { ok: false, code: "unavailable" };
  }

  const companyId = resolveResult.company_id;
  const proposalId = resolveResult.proposal_id;
  const versionId = resolveResult.proposal_version_id;

  let graph: ProposalVersionGraph | null;
  try {
    graph = await input.deps.getVersionGraph(companyId, proposalId, versionId, {
      requireSentVersion: true,
    });
  } catch (error) {
    if (error instanceof ProposalRecordStoreError) {
      return { ok: false, code: "unavailable" };
    }
    return { ok: false, code: "generation_failed" };
  }

  if (!graph) {
    return { ok: false, code: "unavailable" };
  }

  // Exact binding from resolve — never fall back to latest/draft/active.
  if (
    graph.version.id !== versionId ||
    graph.proposal.id !== proposalId ||
    graph.proposal.company_id !== companyId ||
    graph.version.company_id !== companyId
  ) {
    return { ok: false, code: "unavailable" };
  }

  let signatureOverlay: ProposalPdfSignatureOverlay | null = null;
  try {
    signatureOverlay = await input.deps.loadSignatureOverlay({
      companyId,
      proposalId,
      proposalVersionId: versionId,
    });
  } catch {
    signatureOverlay = null;
  }

  const artifactType = selectCustomerProposalPdfArtifactType(signatureOverlay);

  const contractorDeps: ContractorProposalPdfDeps = {
    getVersionGraph: async (cId, pId, vId) => {
      if (cId !== companyId || pId !== proposalId || vId !== versionId) {
        return null;
      }
      return graph;
    },
    readPaymentTerms: input.deps.readPaymentTerms,
    loadSignatureOverlay: input.deps.loadSignatureOverlay,
    render: input.deps.render,
  };

  const result: ContractorProposalPdfResult = await generateContractorProposalPdf({
    companyId,
    proposalId,
    versionId,
    artifactType,
    deps: contractorDeps,
  });

  if (!result.ok) {
    if (result.code === "not_found" || result.code === "signed_unavailable") {
      return { ok: false, code: "unavailable" };
    }
    if (result.code === "invalid_payload") {
      return { ok: false, code: "unavailable" };
    }
    return { ok: false, code: "generation_failed" };
  }

  return {
    ok: true,
    bytes: result.bytes,
    filename: result.filename,
    artifactType: result.artifactType,
    proposalVersionId: result.proposalVersionId,
    pageCount: result.pageCount,
  };
}

export function buildDefaultPublicProposalPdfDeps(
  supabase: SupabaseClient,
  resolveToken: PublicProposalPdfDeps["resolveToken"],
  getVersionGraph: PublicProposalPdfDeps["getVersionGraph"]
): PublicProposalPdfDeps {
  return {
    resolveToken,
    getVersionGraph,
    loadSignatureOverlay: (args) =>
      loadContractorProposalPdfSignatureOverlay(supabase, args),
    readPaymentTerms: async ({ companyId, proposalVersionId }) =>
      readProposalPaymentTerms(supabase, { companyId, proposalVersionId }),
    render: renderProposalPdf,
  };
}
