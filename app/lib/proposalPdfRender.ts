/**
 * Canonical Proposal V2 PDF renderer (pdf-lib).
 * Renders one frozen sent version from the customer packet presenter.
 * Does not reuse the legacy estimate PDF construction.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import {
  PAYMENT_TERMS_SECTION_LABEL,
  formatPaymentTermsCustomerCopy,
} from "@/app/lib/proposalPaymentTerms";
import {
  PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL,
  PROPOSAL_CUSTOMER_PACKET_TOTAL_INVESTMENT_LABEL,
  PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING,
  proposalCustomerAmountLabel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { buildProposalPdfFilename } from "@/app/lib/proposalPdfFilename";
import {
  embedProposalPdfLogo,
  type FetchProposalPdfLogoBytes,
} from "@/app/lib/proposalPdfLogo";
import {
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
  ProposalPdfError,
  type ProposalPdfRenderInput,
  type ProposalPdfRenderResult,
  type ProposalPdfSignatureOverlay,
} from "@/app/lib/proposalPdfTypes";
import {
  stripProposalPdfMarkdown,
  wrapProposalPdfText,
} from "@/app/lib/proposalPdfText";
import type { ProposalSignatureMarkV1 } from "@/app/lib/proposalSignatureMark";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 48;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const COLOR_TEXT = rgb(0.09, 0.12, 0.16);
const COLOR_MUTED = rgb(0.39, 0.45, 0.55);
const COLOR_RULE = rgb(0.86, 0.89, 0.93);
const COLOR_ACCENT = rgb(0.12, 0.25, 0.4);

export type RenderProposalPdfOptions = {
  fetchLogo?: FetchProposalPdfLogoBytes;
  /**
   * When true, result includes every drawn text string for semantic tests.
   * Not used by production download routes.
   */
  includeTextIndex?: boolean;
};

type RenderCtx = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  pageIndex: number;
  frozenDateLabel: string;
  versionOrdinalLabel: string | null;
  textIndex: string[] | null;
};

function recordText(ctx: RenderCtx, text: string): void {
  if (!ctx.textIndex) return;
  const trimmed = text.trim();
  if (trimmed) ctx.textIndex.push(trimmed);
}

function formatFrozenFooterDate(frozenAt: string | null): string {
  const raw = (frozenAt ?? "").trim();
  if (!raw) return "Sent proposal";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return "Sent proposal";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}

function ensureSpace(ctx: RenderCtx, needed: number): void {
  if (ctx.y - needed >= MARGIN_BOTTOM + 18) return;
  drawFooter(ctx);
  ctx.page = ctx.pdfDoc.addPage([PAGE_W, PAGE_H]);
  ctx.pageIndex += 1;
  ctx.y = PAGE_H - MARGIN_TOP;
}

function drawFooter(ctx: RenderCtx): void {
  const parts = [`Prepared ${ctx.frozenDateLabel}`];
  if (ctx.versionOrdinalLabel) {
    parts.push(ctx.versionOrdinalLabel);
  }
  parts.push(`Page ${ctx.pageIndex}`);
  const label = parts.join(" · ");
  recordText(ctx, label);
  ctx.page.drawText(label, {
    x: MARGIN_X,
    y: 28,
    size: 8,
    font: ctx.font,
    color: COLOR_MUTED,
  });
}

function drawRule(ctx: RenderCtx): void {
  ensureSpace(ctx, 14);
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_W - MARGIN_X, y: ctx.y },
    thickness: 0.75,
    color: COLOR_RULE,
  });
  ctx.y -= 14;
}

function drawTextLines(
  ctx: RenderCtx,
  lines: string[],
  opts: {
    size: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
    indent?: number;
  }
): void {
  const font = opts.bold ? ctx.fontBold : ctx.font;
  const color = opts.color ?? COLOR_TEXT;
  const lineHeight = opts.lineHeight ?? opts.size + 4;
  const x = MARGIN_X + (opts.indent ?? 0);
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    if (line.length > 0) {
      recordText(ctx, line);
      ctx.page.drawText(line, {
        x,
        y: ctx.y - opts.size,
        size: opts.size,
        font,
        color,
      });
    }
    ctx.y -= lineHeight;
  }
}

function drawWrapped(
  ctx: RenderCtx,
  text: string,
  opts: {
    size: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
    indent?: number;
    maxWidth?: number;
  }
): void {
  const font = opts.bold ? ctx.fontBold : ctx.font;
  const maxWidth = opts.maxWidth ?? CONTENT_W - (opts.indent ?? 0);
  const lines = wrapProposalPdfText(text, font, opts.size, maxWidth);
  drawTextLines(ctx, lines, opts);
}

function drawHeading(ctx: RenderCtx, title: string): void {
  ensureSpace(ctx, 28);
  drawWrapped(ctx, title, { size: 12, bold: true, color: COLOR_ACCENT, lineHeight: 16 });
  ctx.y -= 4;
}

function drawLabelValue(ctx: RenderCtx, label: string, value: string): void {
  const labelText = `${label}: `;
  const labelW = ctx.fontBold.widthOfTextAtSize(labelText, 10);
  const valueMax = CONTENT_W - labelW;
  const valueLines = wrapProposalPdfText(value, ctx.font, 10, valueMax);
  if (valueLines.length === 0) return;
  ensureSpace(ctx, 14);
  recordText(ctx, labelText + valueLines[0]!);
  ctx.page.drawText(labelText, {
    x: MARGIN_X,
    y: ctx.y - 10,
    size: 10,
    font: ctx.fontBold,
    color: COLOR_MUTED,
  });
  ctx.page.drawText(valueLines[0]!, {
    x: MARGIN_X + labelW,
    y: ctx.y - 10,
    size: 10,
    font: ctx.font,
    color: COLOR_TEXT,
  });
  ctx.y -= 14;
  for (let i = 1; i < valueLines.length; i++) {
    ensureSpace(ctx, 14);
    recordText(ctx, valueLines[i]!);
    ctx.page.drawText(valueLines[i]!, {
      x: MARGIN_X + labelW,
      y: ctx.y - 10,
      size: 10,
      font: ctx.font,
      color: COLOR_TEXT,
    });
    ctx.y -= 14;
  }
}

function measureBlockHeight(
  font: PDFFont,
  fontBold: PDFFont,
  lines: Array<{ text: string; size: number; bold?: boolean; lineHeight?: number }>,
  maxWidth: number
): number {
  let h = 0;
  for (const row of lines) {
    const f = row.bold ? fontBold : font;
    const wrapped = wrapProposalPdfText(row.text, f, row.size, maxWidth);
    const lh = row.lineHeight ?? row.size + 4;
    h += Math.max(wrapped.length, 1) * lh;
  }
  return h;
}

async function drawLogo(
  ctx: RenderCtx,
  logo: PDFImage | null
): Promise<number> {
  if (!logo) return 0;
  const maxH = 42;
  const maxW = 140;
  const scale = Math.min(maxH / logo.height, maxW / logo.width, 1);
  const w = logo.width * scale;
  const h = logo.height * scale;
  ensureSpace(ctx, h + 8);
  ctx.page.drawImage(logo, {
    x: MARGIN_X,
    y: ctx.y - h,
    width: w,
    height: h,
  });
  ctx.y -= h + 10;
  return h;
}

function drawDrawnMark(
  ctx: RenderCtx,
  mark: ProposalSignatureMarkV1,
  box: { x: number; y: number; width: number; height: number }
): void {
  for (const stroke of mark.strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1]!;
      const b = stroke[i]!;
      ctx.page.drawLine({
        start: {
          x: box.x + a.x * box.width,
          y: box.y + (1 - a.y) * box.height,
        },
        end: {
          x: box.x + b.x * box.width,
          y: box.y + (1 - b.y) * box.height,
        },
        thickness: 1.25,
        color: COLOR_TEXT,
      });
    }
  }
}

function drawSignatureBlock(ctx: RenderCtx, overlay: ProposalPdfSignatureOverlay): void {
  const lines: Array<{ text: string; size: number; bold?: boolean; lineHeight?: number }> = [
    { text: "Acceptance", size: 12, bold: true, lineHeight: 16 },
    {
      text:
        overlay.status === "signed"
          ? "This proposal was accepted and signed."
          : "This proposal was accepted.",
      size: 10,
      lineHeight: 14,
    },
  ];
  if (overlay.signerPrintedName) {
    lines.push({
      text: `Signed by: ${overlay.signerPrintedName}`,
      size: 10,
      lineHeight: 14,
    });
  }
  if (overlay.signedOnLabel) {
    lines.push({
      text: `Signed on: ${overlay.signedOnLabel}`,
      size: 10,
      lineHeight: 14,
    });
  } else if (overlay.acceptedOnLabel) {
    lines.push({
      text: `Accepted on: ${overlay.acceptedOnLabel}`,
      size: 10,
      lineHeight: 14,
    });
  }

  const markH = overlay.drawnMark ? 56 : 0;
  const needed =
    measureBlockHeight(ctx.font, ctx.fontBold, lines, CONTENT_W) + markH + 24;
  ensureSpace(ctx, needed);
  drawRule(ctx);
  for (const row of lines) {
    drawWrapped(ctx, row.text, {
      size: row.size,
      bold: row.bold,
      lineHeight: row.lineHeight,
    });
  }
  if (overlay.drawnMark) {
    ensureSpace(ctx, markH + 8);
    const box = {
      x: MARGIN_X,
      y: ctx.y - markH,
      width: Math.min(220, CONTENT_W),
      height: markH,
    };
    ctx.page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      borderColor: COLOR_RULE,
      borderWidth: 0.75,
    });
    drawDrawnMark(ctx, overlay.drawnMark, box);
    ctx.y -= markH + 10;
  }
  ctx.y -= 6;
}

function drawScopeRow(
  ctx: RenderCtx,
  name: string,
  valueLabel: string | null
): void {
  const value = proposalCustomerAmountLabel(valueLabel);
  const leftMax = value ? CONTENT_W * 0.68 : CONTENT_W;
  const nameLines = wrapProposalPdfText(name, ctx.font, 10, leftMax);
  for (let i = 0; i < nameLines.length; i++) {
    ensureSpace(ctx, 14);
    recordText(ctx, i === 0 && value ? `${nameLines[i]!} ${value}` : nameLines[i]!);
    ctx.page.drawText(nameLines[i]!, {
      x: MARGIN_X,
      y: ctx.y - 10,
      size: 10,
      font: ctx.font,
      color: COLOR_TEXT,
    });
    if (i === 0 && value) {
      const vw = ctx.fontBold.widthOfTextAtSize(value, 10);
      ctx.page.drawText(value, {
        x: PAGE_W - MARGIN_X - vw,
        y: ctx.y - 10,
        size: 10,
        font: ctx.fontBold,
        color: COLOR_TEXT,
      });
    }
    ctx.y -= 14;
  }
}

function drawScopeGroupWithContinuation(
  ctx: RenderCtx,
  title: string,
  rows: Array<{ name: string; valueLabel: string | null }>
): void {
  let headingDrawn = false;
  let continuing = false;
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    const value = proposalCustomerAmountLabel(row.valueLabel);
    const leftMax = value ? CONTENT_W * 0.68 : CONTENT_W;
    const nameLines = wrapProposalPdfText(name, ctx.font, 10, leftMax);
    const rowH = Math.max(nameLines.length, 1) * 14;
    const headerH = headingDrawn ? 0 : 24;
    const pageBefore = ctx.pageIndex;
    ensureSpace(ctx, headerH + rowH);
    if (ctx.pageIndex !== pageBefore) {
      continuing = true;
      headingDrawn = false;
    }
    if (!headingDrawn) {
      drawHeading(ctx, continuing ? `${title} (continued)` : title);
      headingDrawn = true;
      continuing = true;
    }
    drawScopeRow(ctx, name, row.valueLabel);
  }
  ctx.y -= 6;
}

/**
 * Render a Proposal PDF from a composed frozen-version input.
 */
export async function renderProposalPdf(
  input: ProposalPdfRenderInput,
  options: RenderProposalPdfOptions = {}
): Promise<ProposalPdfRenderResult> {
  try {
    const packet = input.packet;
    if (!packet?.cover) {
      throw new ProposalPdfError("malformed_content", "PDF packet is missing cover content.");
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const logoUrl = packet.cover.company.logoUrl;
    const logo = await embedProposalPdfLogo(pdfDoc, logoUrl, options.fetchLogo);

    const frozenDateLabel = formatFrozenFooterDate(input.frozenAt);
    const versionOrdinalLabel =
      input.versionNumber != null && input.versionNumber > 0
        ? `Version ${input.versionNumber}`
        : null;

    const ctx: RenderCtx = {
      pdfDoc,
      page: pdfDoc.addPage([PAGE_W, PAGE_H]),
      font,
      fontBold,
      y: PAGE_H - MARGIN_TOP,
      pageIndex: 1,
      frozenDateLabel,
      versionOrdinalLabel,
      textIndex: options.includeTextIndex ? [] : null,
    };

    await drawLogo(ctx, logo);

    const companyName = (packet.cover.company.companyName ?? "").trim();
    if (companyName) {
      drawWrapped(ctx, companyName, { size: 16, bold: true, lineHeight: 20 });
    }
    const tagline = (packet.cover.confidenceCopy ?? "").trim();
    if (tagline) {
      drawWrapped(ctx, tagline, { size: 9, color: COLOR_MUTED, lineHeight: 12 });
    }
    ctx.y -= 4;
    drawRule(ctx);

    drawWrapped(ctx, packet.cover.proposalLabel || "Your roofing proposal", {
      size: 13,
      bold: true,
      lineHeight: 18,
    });
    if (packet.cover.headline) {
      drawWrapped(ctx, packet.cover.headline, { size: 11, lineHeight: 15 });
    }
    ctx.y -= 4;

    if (packet.cover.preparedFor.hasAnyField) {
      drawHeading(ctx, "Prepared for");
      if (packet.cover.preparedFor.customerName) {
        drawLabelValue(ctx, "Customer", packet.cover.preparedFor.customerName);
      }
      if (packet.cover.preparedFor.customerEmail) {
        drawLabelValue(ctx, "Email", packet.cover.preparedFor.customerEmail);
      }
      if (packet.cover.preparedFor.customerPhone) {
        drawLabelValue(ctx, "Phone", packet.cover.preparedFor.customerPhone);
      }
      ctx.y -= 4;
    }

    if (packet.cover.project.hasAnyField) {
      drawHeading(ctx, "Project");
      // jobName here is the customer project label after PDF presentation align
      // (proposal title identity — never property/address).
      if (packet.cover.project.jobName) {
        drawLabelValue(ctx, "Project", packet.cover.project.jobName);
      }
      if (packet.cover.project.propertyAddress) {
        drawLabelValue(ctx, "Property", packet.cover.project.propertyAddress);
      }
      ctx.y -= 4;
    }

    if (packet.footerMetadata?.proposalReferenceLabel) {
      drawLabelValue(ctx, "Proposal", packet.footerMetadata.proposalReferenceLabel);
    }
    if (packet.footerMetadata?.proposalDateLabel) {
      drawLabelValue(ctx, "Date", packet.footerMetadata.proposalDateLabel);
    }

    // Package + total kept together.
    if (packet.estimate) {
      const totalLabel = proposalCustomerAmountLabel(packet.estimate.totalInvestmentLabel);
      const packageLines: Array<{
        text: string;
        size: number;
        bold?: boolean;
        lineHeight?: number;
      }> = [
        { text: PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL, size: 12, bold: true, lineHeight: 16 },
        { text: packet.estimate.label, size: 12, bold: true, lineHeight: 16 },
      ];
      if (packet.estimate.description.trim()) {
        packageLines.push({
          text: stripProposalPdfMarkdown(packet.estimate.description),
          size: 10,
          lineHeight: 14,
        });
      }
      for (const bullet of packet.estimate.bullets) {
        packageLines.push({ text: `• ${bullet}`, size: 10, lineHeight: 14 });
      }
      if (totalLabel) {
        packageLines.push({
          text: `${PROPOSAL_CUSTOMER_PACKET_TOTAL_INVESTMENT_LABEL}: ${totalLabel}`,
          size: 12,
          bold: true,
          lineHeight: 18,
        });
      }
      const needed = measureBlockHeight(ctx.font, ctx.fontBold, packageLines, CONTENT_W) + 16;
      ensureSpace(ctx, needed);
      drawRule(ctx);
      for (const row of packageLines) {
        drawWrapped(ctx, row.text, {
          size: row.size,
          bold: row.bold,
          lineHeight: row.lineHeight,
        });
      }
      ctx.y -= 6;
    }

    // Included work — restart group header after page breaks.
    if (packet.estimate?.includedDetails?.length) {
      drawRule(ctx);
      for (const group of packet.estimate.includedDetails) {
        const title = group.title.trim() || PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL;
        drawScopeGroupWithContinuation(ctx, title, group.lines);
      }
    }

    if (packet.upgrades?.items?.length) {
      drawRule(ctx);
      drawHeading(ctx, PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING);
      for (const item of packet.upgrades.items) {
        const value = proposalCustomerAmountLabel(item.valueLabel);
        const name = item.name.trim();
        if (!name) continue;
        const nameLines = wrapProposalPdfText(
          name,
          ctx.font,
          10,
          value ? CONTENT_W * 0.68 : CONTENT_W
        );
        for (let i = 0; i < nameLines.length; i++) {
          ensureSpace(ctx, 14);
          recordText(
            ctx,
            i === 0 && value ? `${nameLines[i]!} ${value}` : nameLines[i]!
          );
          ctx.page.drawText(nameLines[i]!, {
            x: MARGIN_X,
            y: ctx.y - 10,
            size: 10,
            font: ctx.font,
            color: COLOR_TEXT,
          });
          if (i === 0 && value) {
            const vw = ctx.fontBold.widthOfTextAtSize(value, 10);
            ctx.page.drawText(value, {
              x: PAGE_W - MARGIN_X - vw,
              y: ctx.y - 10,
              size: 10,
              font: ctx.fontBold,
              color: COLOR_TEXT,
            });
          }
          ctx.y -= 14;
        }
      }
      ctx.y -= 6;
    }

    if (packet.paymentTerms) {
      const copy = formatPaymentTermsCustomerCopy(
        packet.paymentTerms,
        packet.selectedTotalCents ?? null
      );
      const termsLines = [
        { text: PAYMENT_TERMS_SECTION_LABEL, size: 12, bold: true as const, lineHeight: 16 },
        { text: copy.depositLine, size: 10, lineHeight: 14 },
        { text: copy.balanceLine, size: 10, lineHeight: 14 },
      ];
      const needed = measureBlockHeight(ctx.font, ctx.fontBold, termsLines, CONTENT_W) + 12;
      ensureSpace(ctx, needed);
      drawRule(ctx);
      for (const row of termsLines) {
        drawWrapped(ctx, row.text, {
          size: row.size,
          bold: row.bold,
          lineHeight: row.lineHeight,
        });
      }
      ctx.y -= 6;
    }

    if (packet.details?.tabs?.length) {
      for (const tab of packet.details.tabs) {
        const body = stripProposalPdfMarkdown(tab.body);
        if (!body) continue;
        drawRule(ctx);
        drawHeading(ctx, tab.title);
        drawWrapped(ctx, body, { size: 10, lineHeight: 14 });
        ctx.y -= 6;
      }
    }

    if (packet.contact) {
      drawRule(ctx);
      drawHeading(ctx, "Contact");
      if (packet.contact.companyName) {
        drawLabelValue(ctx, "Company", packet.contact.companyName);
      }
      if (packet.contact.phone) {
        drawLabelValue(ctx, "Phone", packet.contact.phone);
      }
      if (packet.contact.email) {
        drawLabelValue(ctx, "Email", packet.contact.email);
      }
      if (packet.contact.website) {
        drawLabelValue(ctx, "Website", packet.contact.website);
      }
      if (packet.contact.license) {
        drawLabelValue(ctx, "License", packet.contact.license);
      }
      if (packet.contact.address) {
        drawLabelValue(ctx, "Address", packet.contact.address);
      }
    }

    if (
      input.artifactType === PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL &&
      input.signatureOverlay
    ) {
      drawSignatureBlock(ctx, input.signatureOverlay);
    }

    drawFooter(ctx);

    const bytes = await pdfDoc.save();
    const filename = buildProposalPdfFilename({
      companyName: packet.cover.company.companyName,
      customerName: packet.cover.preparedFor.customerName,
      frozenAt: input.frozenAt,
      artifactType: input.artifactType,
      versionNumber: input.versionNumber,
    });

    return {
      bytes,
      filename,
      artifactType: input.artifactType,
      proposalVersionId: input.proposalVersionId,
      pageCount: pdfDoc.getPageCount(),
      ...(ctx.textIndex ? { textIndex: ctx.textIndex } : {}),
    };
  } catch (error) {
    if (error instanceof ProposalPdfError) throw error;
    throw new ProposalPdfError(
      "generation_failure",
      error instanceof Error ? error.message : "Proposal PDF generation failed."
    );
  }
}
