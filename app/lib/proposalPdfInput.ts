/**
 * Canonical Proposal PDF input composition.
 *
 * Builds render input from an exact frozen ProposalVersionGraph via the
 * existing public graph DTO + customer packet presenters.
 * No Catalog, Measurements, Builder extras, or latest-pointer fallback.
 */

import { buildCustomerPacketFromPublicDto } from "@/app/lib/proposalCustomerPacketPresenter";
import {
  formatProposalCustomerAcceptedOnLabel,
  type ProposalCustomerPacketViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { resolveSelectedTemplateOptionIdFromGraph } from "@/app/lib/proposalDraftGraphAdapter";
import { isUuidLike } from "@/app/lib/uuid";
import {
  buildProposalPublicGraphDto,
  type ProposalPublicGraphDto,
  type ProposalPublicGraphInput,
} from "@/app/lib/proposalPublicGraphDto";
import type { ProposalPaymentTerms } from "@/app/lib/proposalPaymentTerms";
import type { ProposalDraftGraph, ProposalVersionGraph } from "@/app/lib/proposalRecordStore";
import { proposalSignatureMarkError } from "@/app/lib/proposalSignatureMark";
import {
  PROPOSAL_PDF_ARTIFACT_SENT,
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
  ProposalPdfError,
  type ProposalPdfArtifactType,
  type ProposalPdfRenderInput,
  type ProposalPdfSignatureOverlay,
} from "@/app/lib/proposalPdfTypes";

const FROZEN_PDF_VERSION_KINDS = new Set(["sent", "signed"]);

export type BuildProposalPdfRenderInputArgs = {
  /** Exact version graph already loaded for proposalVersionId. */
  graph: ProposalVersionGraph;
  /** Must match graph.version.id — never fall back to latest sent. */
  proposalVersionId: string;
  /** Must match graph.proposal.company_id / version.company_id. */
  companyId: string;
  artifactType: ProposalPdfArtifactType;
  /** Version-scoped payment terms; null when none frozen. */
  paymentTerms: ProposalPaymentTerms | null;
  /**
   * Optional display package key. Defaults to frozen graph selection.
   * Do not pass live Catalog ids.
   */
  selectedTemplateOptionId?: string | null;
  /**
   * Acceptance/signature overlay. Required for signed_final_pdf.
   * Ignored (stripped) for sent_proposal_pdf.
   */
  signatureOverlay?: ProposalPdfSignatureOverlay | null;
};

function assertExactFrozenVersion(input: {
  graph: ProposalVersionGraph;
  proposalVersionId: string;
  companyId: string;
}): void {
  const expectedVersionId = (input.proposalVersionId ?? "").trim();
  const expectedCompanyId = (input.companyId ?? "").trim();

  if (!isUuidLike(expectedVersionId) || !isUuidLike(expectedCompanyId)) {
    throw new ProposalPdfError(
      "invalid_version",
      "Proposal PDF requires an exact company and proposal version id."
    );
  }

  const graphVersionId = (input.graph.version?.id ?? "").trim();
  const graphCompanyId = (
    input.graph.version?.company_id ??
    input.graph.proposal?.company_id ??
    ""
  ).trim();

  if (!graphVersionId || !isUuidLike(graphVersionId)) {
    throw new ProposalPdfError("missing_graph", "Frozen proposal version graph is missing.");
  }

  if (graphVersionId !== expectedVersionId) {
    throw new ProposalPdfError(
      "invalid_version",
      "Proposal PDF version id does not match the loaded frozen graph."
    );
  }

  if (graphCompanyId !== expectedCompanyId) {
    throw new ProposalPdfError(
      "company_mismatch",
      "Proposal PDF company does not match the frozen graph."
    );
  }

  const kind = (input.graph.version.version_kind ?? "").trim().toLowerCase();
  if (!FROZEN_PDF_VERSION_KINDS.has(kind)) {
    throw new ProposalPdfError(
      "non_sent_version",
      `Proposal PDF requires a frozen sent version (got ${kind || "unknown"}).`
    );
  }

  if (!(input.graph.version.frozen_at ?? "").trim()) {
    throw new ProposalPdfError(
      "non_sent_version",
      "Proposal PDF requires a frozen_at timestamp on the sent version."
    );
  }
}

function resolveSelectedTotalCents(
  dto: ProposalPublicGraphDto,
  packet: ProposalCustomerPacketViewModel
): number | null {
  const current = packet.comparison?.options.find((option) => option.isCurrent);
  if (current?.totalCents != null && Number.isInteger(current.totalCents)) {
    return current.totalCents;
  }
  const selectedKey = (dto.selected_template_option_id ?? "").trim();
  const option =
    (selectedKey
      ? dto.options.find((row) => row.source_template_option_id === selectedKey)
      : null) ?? dto.options.find((row) => row.visible_to_customer);
  const cents = option?.customer_total_cents;
  return cents != null && Number.isInteger(cents) ? cents : null;
}

function normalizeSignatureOverlay(
  overlay: ProposalPdfSignatureOverlay | null | undefined
): ProposalPdfSignatureOverlay | null {
  if (!overlay) return null;
  if (overlay.status !== "accepted" && overlay.status !== "signed") {
    throw new ProposalPdfError(
      "malformed_content",
      "Signed PDF requires accepted or signed status."
    );
  }
  const drawn = overlay.drawnMark ?? null;
  if (drawn != null && proposalSignatureMarkError(drawn)) {
    throw new ProposalPdfError(
      "malformed_content",
      "Signed PDF drawn mark is invalid."
    );
  }
  return {
    status: overlay.status,
    signerPrintedName: (overlay.signerPrintedName ?? "").trim() || null,
    acceptedOnLabel: (overlay.acceptedOnLabel ?? "").trim() || null,
    signedOnLabel: (overlay.signedOnLabel ?? "").trim() || null,
    drawnMark: drawn,
  };
}

export function buildProposalPdfSignatureOverlayFromAcceptance(input: {
  acceptedAt: string | null | undefined;
  signedAt?: string | null | undefined;
  signerPrintedName?: string | null | undefined;
  drawnMark?: ProposalPdfSignatureOverlay["drawnMark"];
}): ProposalPdfSignatureOverlay | null {
  const acceptedAt = (input.acceptedAt ?? "").trim();
  if (!acceptedAt) return null;
  const signedAt = (input.signedAt ?? "").trim();
  const signedOnLabel = formatProposalCustomerAcceptedOnLabel(signedAt || null);
  const acceptedOnLabel = formatProposalCustomerAcceptedOnLabel(acceptedAt);
  return normalizeSignatureOverlay({
    status: signedAt ? "signed" : "accepted",
    signerPrintedName: (input.signerPrintedName ?? "").trim() || null,
    acceptedOnLabel,
    signedOnLabel: signedAt ? signedOnLabel : null,
    drawnMark: input.drawnMark ?? null,
  });
}

/**
 * Compose canonical PDF render input from an exact frozen version graph.
 * Does not load DB. Does not fall back to latest_sent_version_id.
 */
export function buildProposalPdfRenderInput(
  args: BuildProposalPdfRenderInputArgs
): ProposalPdfRenderInput {
  if (!args.graph) {
    throw new ProposalPdfError("missing_graph", "Frozen proposal version graph is required.");
  }
  if (
    args.artifactType !== PROPOSAL_PDF_ARTIFACT_SENT &&
    args.artifactType !== PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL
  ) {
    throw new ProposalPdfError("malformed_content", "Unknown proposal PDF artifact type.");
  }

  assertExactFrozenVersion({
    graph: args.graph,
    proposalVersionId: args.proposalVersionId,
    companyId: args.companyId,
  });

  let dto: ProposalPublicGraphDto;
  try {
    const selectedTemplateOptionId =
      (args.selectedTemplateOptionId ?? "").trim() ||
      resolveSelectedTemplateOptionIdFromGraph(
        args.graph as unknown as ProposalDraftGraph
      );
    dto = buildProposalPublicGraphDto(
      args.graph as ProposalPublicGraphInput,
      selectedTemplateOptionId
    );
  } catch (error) {
    throw new ProposalPdfError(
      "malformed_content",
      error instanceof Error
        ? `Frozen proposal content could not be presented: ${error.message}`
        : "Frozen proposal content could not be presented."
    );
  }

  const packet = buildCustomerPacketFromPublicDto(dto);
  const selectedTotalCents = resolveSelectedTotalCents(dto, packet);
  packet.paymentTerms = args.paymentTerms;
  packet.selectedTotalCents = selectedTotalCents;
  // Public payment VM is route/ledger-owned — omit from PDF packet.
  packet.payment = null;

  // Sent artifact never carries acceptance/signature overlay.
  let signatureOverlay: ProposalPdfSignatureOverlay | null = null;
  if (args.artifactType === PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL) {
    signatureOverlay = normalizeSignatureOverlay(args.signatureOverlay);
    if (!signatureOverlay) {
      throw new ProposalPdfError(
        "malformed_content",
        "signed_final_pdf requires an acceptance/signature overlay."
      );
    }
    packet.acceptance = {
      status: signatureOverlay.status,
      acceptedOnLabel: signatureOverlay.acceptedOnLabel,
      signedOnLabel: signatureOverlay.signedOnLabel,
      signerDisplayName: signatureOverlay.signerPrintedName,
    };
  } else {
    packet.acceptance = {
      status: "open",
      acceptedOnLabel: null,
      signedOnLabel: null,
      signerDisplayName: null,
    };
  }

  const versionNumber = Number.isFinite(args.graph.version.version_number)
    ? Math.floor(args.graph.version.version_number)
    : null;

  return {
    artifactType: args.artifactType,
    proposalVersionId: args.proposalVersionId.trim(),
    companyId: args.companyId.trim(),
    versionNumber,
    frozenAt: (args.graph.version.frozen_at ?? "").trim() || null,
    packet,
    signatureOverlay,
  };
}
