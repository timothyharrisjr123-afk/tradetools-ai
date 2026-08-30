/**
 * Browser helper for contractor Proposal PDF download.
 * Identity only — server reloads frozen truth.
 */

"use client";

import {
  CONTRACTOR_PDF_UNAVAILABLE_MESSAGE,
  buildContractorProposalPdfHref,
} from "@/app/lib/proposalPdfContractorDownload";
import type { ProposalPdfArtifactType } from "@/app/lib/proposalPdfTypes";

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      /* fall through */
    }
  }
  const plain = header.match(/filename\s*=\s*"([^"]+)"/i) ?? header.match(/filename\s*=\s*([^;]+)/i);
  return plain?.[1]?.trim() || null;
}

export async function downloadContractorProposalPdf(input: {
  proposalId: string;
  versionId: string;
  artifactType: ProposalPdfArtifactType;
}): Promise<{ ok: true; filename: string } | { ok: false; message: string }> {
  const href = buildContractorProposalPdfHref(input);
  try {
    const response = await fetch(href, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/pdf" },
    });
    if (!response.ok) {
      return { ok: false, message: CONTRACTOR_PDF_UNAVAILABLE_MESSAGE };
    }
    const blob = await response.blob();
    if (!blob || blob.size < 8) {
      return { ok: false, message: CONTRACTOR_PDF_UNAVAILABLE_MESSAGE };
    }
    const filename =
      parseFilenameFromDisposition(response.headers.get("Content-Disposition")) ??
      "Proposal.pdf";
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
    return { ok: true, filename };
  } catch {
    return { ok: false, message: CONTRACTOR_PDF_UNAVAILABLE_MESSAGE };
  }
}
