/**
 * Contractor Proposal PDF download orchestration.
 * Browser supplies proposal/version/artifact identity only.
 * Server reloads frozen truth through Group 1 renderer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildProposalPdfRenderInput, buildProposalPdfSignatureOverlayFromAcceptance } from "@/app/lib/proposalPdfInput";
import { renderProposalPdf } from "@/app/lib/proposalPdfRender";
import {
  PROPOSAL_PDF_ARTIFACT_SENT,
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
  ProposalPdfError,
  isProposalPdfArtifactType,
  type ProposalPdfArtifactType,
  type ProposalPdfSignatureOverlay,
} from "@/app/lib/proposalPdfTypes";
import { readProposalPaymentTerms } from "@/app/lib/proposalPaymentTermsPersistence";
import {
  ProposalRecordStoreError,
  getProposalVersionGraph,
  type ProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";
import { assertProposalSignatureMark, type ProposalSignatureMarkV1 } from "@/app/lib/proposalSignatureMark";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/uuid";

export const CONTRACTOR_PDF_DOWNLOAD_LABEL = "Download PDF" as const;
export const CONTRACTOR_PDF_DOWNLOAD_SIGNED_LABEL = "Download signed PDF" as const;
export const CONTRACTOR_PDF_PREPARING_LABEL = "Preparing PDF…" as const;
export const CONTRACTOR_PDF_UNAVAILABLE_MESSAGE = "PDF unavailable. Try again." as const;

export type ContractorProposalPdfFailureCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_payload"
  | "not_found"
  | "signed_unavailable"
  | "generation_failed";

export type ContractorProposalPdfSuccess = {
  ok: true;
  bytes: Uint8Array;
  filename: string;
  artifactType: ProposalPdfArtifactType;
  proposalVersionId: string;
  pageCount: number;
};

export type ContractorProposalPdfFailure = {
  ok: false;
  code: ContractorProposalPdfFailureCode;
};

export type ContractorProposalPdfResult =
  | ContractorProposalPdfSuccess
  | ContractorProposalPdfFailure;

export type ContractorProposalPdfDeps = {
  getVersionGraph: (
    companyId: string,
    proposalId: string,
    versionId: string
  ) => Promise<ProposalVersionGraph | null>;
  readPaymentTerms: (input: {
    companyId: string;
    proposalVersionId: string;
  }) => Promise<Awaited<ReturnType<typeof readProposalPaymentTerms>>>;
  loadSignatureOverlay: (input: {
    companyId: string;
    proposalId: string;
    proposalVersionId: string;
  }) => Promise<ProposalPdfSignatureOverlay | null>;
  render: typeof renderProposalPdf;
};

export function parseContractorProposalPdfArtifactType(
  value: string | null | undefined
): ProposalPdfArtifactType | null {
  const raw = (value ?? "").trim();
  if (!raw) return PROPOSAL_PDF_ARTIFACT_SENT;
  if (!isProposalPdfArtifactType(raw)) return null;
  return raw;
}

export function contractorProposalPdfHttpStatus(
  code: ContractorProposalPdfFailureCode
): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "invalid_payload":
      return 400;
    case "not_found":
    case "signed_unavailable":
      return 404;
    case "generation_failed":
      return 500;
    default:
      return 500;
  }
}

function parseDrawnMark(value: unknown): ProposalSignatureMarkV1 | null {
  if (value == null) return null;
  try {
    assertProposalSignatureMark(value);
    return value;
  } catch {
    return null;
  }
}

/**
 * Load acceptance/signature overlay for an exact proposal version.
 * Returns null when no acceptance exists for that version.
 */
export async function loadContractorProposalPdfSignatureOverlay(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    proposalId: string;
    proposalVersionId: string;
  }
): Promise<ProposalPdfSignatureOverlay | null> {
  const companyId = input.companyId.trim();
  const proposalId = input.proposalId.trim();
  const proposalVersionId = input.proposalVersionId.trim();
  if (
    !isUuidLike(companyId) ||
    !isUuidLike(proposalId) ||
    !isUuidLike(proposalVersionId)
  ) {
    return null;
  }

  const { data: acceptance, error } = await supabase
    .from("proposal_acceptances")
    .select("id,accepted_at")
    .eq("company_id", companyId)
    .eq("proposal_id", proposalId)
    .eq("proposal_version_id", proposalVersionId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !acceptance?.accepted_at) return null;
  const acceptanceId = String(acceptance.id ?? "").trim();
  const acceptedAt = String(acceptance.accepted_at);

  if (!acceptanceId) {
    return buildProposalPdfSignatureOverlayFromAcceptance({ acceptedAt });
  }

  const { data: signature } = await supabase
    .from("proposal_signatures")
    .select("signed_at,signer_printed_name,drawn_mark_json")
    .eq("company_id", companyId)
    .eq("proposal_acceptance_id", acceptanceId)
    .eq("proposal_version_id", proposalVersionId)
    .eq("signer_slot", "customer_primary")
    .maybeSingle();

  if (!signature?.signed_at) {
    return buildProposalPdfSignatureOverlayFromAcceptance({ acceptedAt });
  }

  return buildProposalPdfSignatureOverlayFromAcceptance({
    acceptedAt,
    signedAt: String(signature.signed_at),
    signerPrintedName: signature.signer_printed_name
      ? String(signature.signer_printed_name)
      : null,
    drawnMark: parseDrawnMark(signature.drawn_mark_json),
  });
}

/** Client-safe probe: does this exact version have acceptance/signature truth? */
export async function hasContractorProposalPdfSignedFinal(
  input: {
    companyId: string;
    proposalId: string;
    proposalVersionId: string;
  }
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const overlay = await loadContractorProposalPdfSignatureOverlay(supabase, input);
  return overlay != null;
}

export function buildDefaultContractorProposalPdfDeps(
  supabase: SupabaseClient
): ContractorProposalPdfDeps {
  return {
    getVersionGraph: async (companyId, proposalId, versionId) => {
      try {
        return await getProposalVersionGraph(
          companyId,
          proposalId,
          versionId,
          { requireSentVersion: true },
          {
            getSupabase: () =>
              supabase as unknown as NonNullable<ReturnType<typeof getSupabaseClient>>,
          }
        );
      } catch (error) {
        if (error instanceof ProposalRecordStoreError) {
          return null;
        }
        throw error;
      }
    },
    readPaymentTerms: async ({ companyId, proposalVersionId }) =>
      readProposalPaymentTerms(supabase, { companyId, proposalVersionId }),
    loadSignatureOverlay: (args) =>
      loadContractorProposalPdfSignatureOverlay(supabase, args),
    render: renderProposalPdf,
  };
}

/**
 * Generate a contractor PDF for an exact frozen version.
 * Caller must already authenticate and resolve companyId.
 */
export async function generateContractorProposalPdf(input: {
  companyId: string;
  proposalId: string;
  versionId: string;
  artifactType: ProposalPdfArtifactType;
  deps: ContractorProposalPdfDeps;
}): Promise<ContractorProposalPdfResult> {
  const companyId = (input.companyId ?? "").trim();
  const proposalId = (input.proposalId ?? "").trim();
  const versionId = (input.versionId ?? "").trim();

  if (
    !isUuidLike(companyId) ||
    !isUuidLike(proposalId) ||
    !isUuidLike(versionId) ||
    !isProposalPdfArtifactType(input.artifactType)
  ) {
    return { ok: false, code: "invalid_payload" };
  }

  let graph: ProposalVersionGraph | null;
  try {
    graph = await input.deps.getVersionGraph(companyId, proposalId, versionId);
  } catch {
    return { ok: false, code: "generation_failed" };
  }

  if (!graph) {
    return { ok: false, code: "not_found" };
  }

  // Exact binding — never trust a mismatched loaded row.
  if (
    graph.version.id !== versionId ||
    graph.proposal.id !== proposalId ||
    graph.proposal.company_id !== companyId ||
    graph.version.company_id !== companyId
  ) {
    return { ok: false, code: "not_found" };
  }

  let signatureOverlay: ProposalPdfSignatureOverlay | null = null;
  if (input.artifactType === PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL) {
    signatureOverlay = await input.deps.loadSignatureOverlay({
      companyId,
      proposalId,
      proposalVersionId: versionId,
    });
    if (!signatureOverlay) {
      return { ok: false, code: "signed_unavailable" };
    }
  }

  const paymentTerms = await input.deps.readPaymentTerms({
    companyId,
    proposalVersionId: versionId,
  });

  try {
    const renderInput = buildProposalPdfRenderInput({
      graph,
      proposalVersionId: versionId,
      companyId,
      artifactType: input.artifactType,
      paymentTerms,
      signatureOverlay,
    });
    const rendered = await input.deps.render(renderInput);
    return {
      ok: true,
      bytes: rendered.bytes,
      filename: rendered.filename,
      artifactType: rendered.artifactType,
      proposalVersionId: rendered.proposalVersionId,
      pageCount: rendered.pageCount,
    };
  } catch (error) {
    if (error instanceof ProposalPdfError) {
      if (
        error.code === "invalid_version" ||
        error.code === "non_sent_version" ||
        error.code === "missing_graph" ||
        error.code === "company_mismatch"
      ) {
        return { ok: false, code: "not_found" };
      }
      if (error.code === "malformed_content") {
        return { ok: false, code: "generation_failed" };
      }
    }
    return { ok: false, code: "generation_failed" };
  }
}

export function buildContractorProposalPdfHref(input: {
  proposalId: string;
  versionId: string;
  artifactType?: ProposalPdfArtifactType;
}): string {
  const proposalId = input.proposalId.trim();
  const versionId = input.versionId.trim();
  const artifact = input.artifactType ?? PROPOSAL_PDF_ARTIFACT_SENT;
  const params = new URLSearchParams();
  if (artifact !== PROPOSAL_PDF_ARTIFACT_SENT) {
    params.set("artifact", artifact);
  }
  const query = params.toString();
  return (
    `/api/proposals/${encodeURIComponent(proposalId)}/versions/${encodeURIComponent(versionId)}/pdf` +
    (query ? `?${query}` : "")
  );
}

function contentDispositionAttachment(filename: string): string {
  const safe = filename.replace(/["\\\r\n]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export function contractorProposalPdfResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": contentDispositionAttachment(filename),
    "Cache-Control": "no-store",
  };
}
