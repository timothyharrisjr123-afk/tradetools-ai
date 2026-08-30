/**
 * Proposal PDF V1 — artifact types and typed errors.
 * PDF is a rendering of one frozen sent/signed proposal version.
 * No storage, routes, or second proposal truth.
 */

import type { ProposalCustomerPacketViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import type { ProposalSignatureMarkV1 } from "@/app/lib/proposalSignatureMark";

export const PROPOSAL_PDF_ARTIFACT_SENT = "sent_proposal_pdf" as const;
export const PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL = "signed_final_pdf" as const;

export const PROPOSAL_PDF_ARTIFACT_TYPES = [
  PROPOSAL_PDF_ARTIFACT_SENT,
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
] as const;

export type ProposalPdfArtifactType = (typeof PROPOSAL_PDF_ARTIFACT_TYPES)[number];

export type ProposalPdfErrorCode =
  | "invalid_version"
  | "non_sent_version"
  | "missing_graph"
  | "company_mismatch"
  | "malformed_content"
  | "generation_failure";

export class ProposalPdfError extends Error {
  readonly code: ProposalPdfErrorCode;

  constructor(code: ProposalPdfErrorCode, message: string) {
    super(message);
    this.name = "ProposalPdfError";
    this.code = code;
  }
}

export function isProposalPdfArtifactType(value: unknown): value is ProposalPdfArtifactType {
  return (
    value === PROPOSAL_PDF_ARTIFACT_SENT || value === PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL
  );
}

/** Acceptance/signature overlay — used only for signed_final_pdf. */
export type ProposalPdfSignatureOverlay = {
  status: "accepted" | "signed";
  signerPrintedName: string | null;
  acceptedOnLabel: string | null;
  signedOnLabel: string | null;
  /** Optional drawn mark; omit when absent. Never invent a PNG. */
  drawnMark?: ProposalSignatureMarkV1 | null;
};

/**
 * Canonical PDF render input — composed from customer packet + frozen version
 * metadata. Does not carry Builder graph, Catalog, or live Settings.
 */
export type ProposalPdfRenderInput = {
  artifactType: ProposalPdfArtifactType;
  /** Exact frozen version id — identity only; never printed as customer UUID. */
  proposalVersionId: string;
  companyId: string;
  versionNumber: number | null;
  frozenAt: string | null;
  packet: ProposalCustomerPacketViewModel;
  /**
   * Required for signed_final_pdf; ignored for sent_proposal_pdf
   * (sent never gains a signature overlay).
   */
  signatureOverlay: ProposalPdfSignatureOverlay | null;
};

export type ProposalPdfRenderResult = {
  bytes: Uint8Array;
  filename: string;
  artifactType: ProposalPdfArtifactType;
  proposalVersionId: string;
  pageCount: number;
  /** Present only when render was called with includeTextIndex. */
  textIndex?: string[];
};
