/**
 * Frozen company logo embedding for Proposal PDF.
 * Fail-open: logo fetch failure never fails PDF generation.
 */

import type { PDFDocument, PDFImage } from "pdf-lib";

export const PROPOSAL_PDF_LOGO_FETCH_TIMEOUT_MS = 2500;
export const PROPOSAL_PDF_LOGO_MAX_BYTES = 1_500_000;

export type ProposalPdfLogoFetchResult =
  | { ok: true; bytes: Uint8Array; mime: "image/png" | "image/jpeg" }
  | { ok: false; reason: string };

function parseDataUrl(
  dataUrl: string
): { bytes: Uint8Array; mime: "image/png" | "image/jpeg" } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const mimeRaw = match[1]!.toLowerCase();
  const mime: "image/png" | "image/jpeg" =
    mimeRaw === "image/png" ? "image/png" : "image/jpeg";
  try {
    const binary = Buffer.from(match[2]!.replace(/\s+/g, ""), "base64");
    if (binary.byteLength < 8 || binary.byteLength > PROPOSAL_PDF_LOGO_MAX_BYTES) {
      return null;
    }
    return { bytes: new Uint8Array(binary), mime };
  } catch {
    return null;
  }
}

function sniffMime(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

export type FetchProposalPdfLogoBytes = (
  logoUrl: string
) => Promise<ProposalPdfLogoFetchResult>;

export const fetchProposalPdfLogoBytes: FetchProposalPdfLogoBytes = async (logoUrl) => {
  const url = (logoUrl ?? "").trim();
  if (!url) return { ok: false, reason: "empty" };

  if (url.startsWith("data:image/")) {
    const parsed = parseDataUrl(url);
    if (!parsed) return { ok: false, reason: "invalid_data_url" };
    return { ok: true, bytes: parsed.bytes, mime: parsed.mime };
  }

  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, reason: "unsupported_scheme" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROPOSAL_PDF_LOGO_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength < 8 || buffer.byteLength > PROPOSAL_PDF_LOGO_MAX_BYTES) {
      return { ok: false, reason: "size" };
    }
    const sniffed = sniffMime(buffer);
    if (!sniffed) return { ok: false, reason: "unsupported_type" };
    if (
      contentType &&
      !contentType.includes("image/png") &&
      !contentType.includes("image/jpeg") &&
      !contentType.includes("image/jpg") &&
      !contentType.includes("octet-stream")
    ) {
      // Prefer sniff over header when header is wrong but bytes look valid.
      if (!sniffed) return { ok: false, reason: "content_type" };
    }
    return { ok: true, bytes: buffer, mime: sniffed };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
};

export async function embedProposalPdfLogo(
  pdfDoc: PDFDocument,
  logoUrl: string | null | undefined,
  fetchLogo: FetchProposalPdfLogoBytes = fetchProposalPdfLogoBytes
): Promise<PDFImage | null> {
  const url = (logoUrl ?? "").trim();
  if (!url) return null;
  try {
    const fetched = await fetchLogo(url);
    if (!fetched.ok) return null;
    if (fetched.mime === "image/png") {
      return await pdfDoc.embedPng(fetched.bytes);
    }
    return await pdfDoc.embedJpg(fetched.bytes);
  } catch {
    return null;
  }
}
