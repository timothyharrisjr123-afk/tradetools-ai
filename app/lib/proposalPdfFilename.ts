/**
 * Deterministic sanitized proposal PDF filenames.
 * Date comes from frozen_at. No raw UUIDs. No public tokens.
 */

import {
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
  type ProposalPdfArtifactType,
} from "@/app/lib/proposalPdfTypes";

const FILENAME_MAX_LEN = 120;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Safe filesystem segment: letters, digits, hyphen, underscore. */
export function sanitizeProposalPdfFilenameSegment(
  value: string | null | undefined,
  fallback: string
): string {
  const collapsed = collapseWhitespace(value ?? "");
  const cleaned = collapsed
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[^A-Za-z0-9 _.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  if (!cleaned) return fallback;
  return cleaned.slice(0, 48);
}

export function formatProposalPdfFrozenDate(frozenAt: string | null | undefined): string {
  const raw = (frozenAt ?? "").trim();
  if (!raw) return "undated";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return "undated";
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type BuildProposalPdfFilenameInput = {
  companyName: string | null | undefined;
  customerName: string | null | undefined;
  frozenAt: string | null | undefined;
  artifactType: ProposalPdfArtifactType;
  /** Include `_vN` when > 1 (contractor disambiguation). */
  versionNumber?: number | null;
};

export function buildProposalPdfFilename(input: BuildProposalPdfFilenameInput): string {
  const company = sanitizeProposalPdfFilenameSegment(input.companyName, "Company");
  const customer = sanitizeProposalPdfFilenameSegment(input.customerName, "Customer");
  const date = formatProposalPdfFrozenDate(input.frozenAt);
  const parts = [`${company}_${customer}_Proposal_${date}`];

  const versionNumber =
    input.versionNumber != null && Number.isFinite(input.versionNumber)
      ? Math.floor(input.versionNumber)
      : null;
  if (versionNumber != null && versionNumber > 1) {
    parts.push(`v${versionNumber}`);
  }

  if (input.artifactType === PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL) {
    parts.push("Signed");
  }

  let base = parts.join("_");
  if (base.length > FILENAME_MAX_LEN - 4) {
    base = base.slice(0, FILENAME_MAX_LEN - 4);
  }
  return `${base}.pdf`;
}
