/**
 * R18D3B — Pure transactional proposal email template (HTML + text).
 *
 * Premium contractor-branded layout. No Resend, routes, lifecycle mutation,
 * PDF, Sign, or Payment language.
 */

import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import { buildPublicProposalReviewUrl } from "@/app/lib/proposalPublicReviewReadiness";

export const PROPOSAL_EMAIL_CTA_LABEL = "Review proposal";

export const PROPOSAL_EMAIL_HEADLINE = "Your roofing proposal is ready";

export const PROPOSAL_EMAIL_BRAND_ACCENT = "#0891b2";

export const PROPOSAL_EMAIL_CTA_BACKGROUND = PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;

export type BuildProposalEmailTemplateInput = {
  origin: string;
  rawToken: string;
  subject: string;
  body: string;
  companyName?: string | null;
  customerFirstName?: string | null;
  projectAddress?: string | null;
};

export type ProposalEmailTemplate = {
  subject: string;
  html: string;
  text: string;
  publicPath: string;
  preheader: string;
  usesLocalhostOrigin: boolean;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isLocalhostPublicOrigin(origin: string): boolean {
  const trimmed = origin.trim();
  if (!trimmed) return false;
  try {
    const hostname = new URL(trimmed).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(trimmed);
  }
}

export function buildProposalEmailPreheader(projectAddress?: string | null): string {
  const address = (projectAddress ?? "").trim();
  if (address) {
    const shortAddress = address.split(",")[0]?.trim() || address;
    return `Review your roofing proposal for ${shortAddress}.`;
  }
  return "Review your roofing proposal online.";
}

export function formatProposalEmailInvestment(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) {
    return null;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const BODY_LINK_PLACEHOLDER_PATTERNS = [
  /^available after send$/i,
  /^review your proposal here:?$/i,
  /^review proposal:?$/i,
  /^view proposal:?$/i,
  /^view your proposal:?$/i,
];

export function sanitizeProposalEmailBody(body: string, projectAddress?: string | null): string {
  const address = (projectAddress ?? "").trim();
  const lines = body.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return true;
    }
    if (BODY_LINK_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      return false;
    }
    if (address.length > 0 && trimmed === address) {
      return false;
    }
    if (/^(project|package|investment):?$/i.test(trimmed)) {
      return false;
    }
    if (/^questions\?/i.test(trimmed)) {
      return false;
    }
    return true;
  });

  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function bodyToHtmlParagraphs(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => escapeHtml(line.trim()))
        .filter((line) => line.length > 0)
        .join("<br />");
      return `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:#334155;">${lines}</p>`;
    })
    .join("");
}

function buildSummaryRow(label: string, value: string): string {
  return `<tr>
      <td style="padding:0 0 10px 0;vertical-align:top;width:96px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</td>
      <td style="padding:0 0 10px 0;vertical-align:top;font-size:15px;line-height:1.5;color:#0f172a;">${escapeHtml(value)}</td>
    </tr>`;
}

function buildSummaryCardHtml(projectAddress: string | null): string {
  if (!projectAddress) {
    return "";
  }

  const row = buildSummaryRow("Project", projectAddress).replace(
    "padding:0 0 10px 0",
    "padding:0"
  );

  return `<div style="margin:0 0 24px 0;padding:18px 20px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${row}</table>
      </div>`;
}

function buildFallbackSectionHtml(publicUrl: string, isLocalhost: boolean): string {
  if (isLocalhost) {
    return "";
  }

  return `<p style="margin:0;font-size:11px;line-height:1.55;color:#94a3b8;">If the button does not work, copy and paste this link into your browser:<br /><span style="word-break:break-all;color:#64748b;">${escapeHtml(publicUrl)}</span></p>`;
}

function buildTextFallback(input: {
  body: string;
  companyName: string;
  projectAddress: string | null;
  publicUrl: string;
  isLocalhost: boolean;
}): string {
  const parts = [input.body.trim()];

  if (input.projectAddress) {
    parts.push("", "Project", input.projectAddress);
  }

  parts.push("", PROPOSAL_EMAIL_CTA_LABEL);
  if (!input.isLocalhost) {
    parts.push(input.publicUrl);
  }

  parts.push("", `Questions? Reply to this email and ${input.companyName} will follow up.`);

  return parts.filter((part, index) => index < 2 || part.length > 0).join("\n");
}

export function buildProposalEmailTemplate(
  input: BuildProposalEmailTemplateInput
): ProposalEmailTemplate {
  const origin = input.origin.trim().replace(/\/$/, "");
  const rawToken = input.rawToken.trim();
  const publicUrl = buildPublicProposalReviewUrl(origin, rawToken);
  const publicPath = `/p/${encodeURIComponent(rawToken)}`;
  const subject = input.subject.trim();
  const companyName = (input.companyName ?? "").trim() || "Your contractor";
  const projectAddress = (input.projectAddress ?? "").trim() || null;
  const preheader = buildProposalEmailPreheader(projectAddress);
  const isLocalhost = isLocalhostPublicOrigin(origin);
  const sanitizedBody = sanitizeProposalEmailBody(input.body, projectAddress);
  const htmlBody = bodyToHtmlParagraphs(sanitizedBody);
  const summaryCard = buildSummaryCardHtml(projectAddress);
  const fallbackSection = buildFallbackSectionHtml(publicUrl, isLocalhost);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2f6;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <div style="padding:28px 16px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ea;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
        <div style="height:4px;background:${PROPOSAL_EMAIL_BRAND_ACCENT};"></div>
        <div style="padding:28px 28px 0 28px;">
          <div style="font-size:20px;line-height:1.3;font-weight:700;color:#0f172a;">${escapeHtml(companyName)}</div>
        </div>
        <div style="padding:22px 28px 28px 28px;">
          <h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;">${escapeHtml(PROPOSAL_EMAIL_HEADLINE)}</h1>
          ${htmlBody}
          ${summaryCard}
          <div style="margin:0 0 18px 0;text-align:center;">
            <a href="${escapeHtml(publicUrl)}" style="display:inline-block;background:${PROPOSAL_EMAIL_CTA_BACKGROUND};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;min-height:44px;line-height:16px;box-sizing:border-box;">${PROPOSAL_EMAIL_CTA_LABEL}</a>
          </div>
          <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#475569;">Questions? Reply to this email and ${escapeHtml(companyName)} will follow up.</p>
          ${fallbackSection}
          <p style="margin:18px 0 0 0;padding-top:16px;border-top:1px solid #eef2f6;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">${escapeHtml(companyName)}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = buildTextFallback({
    body: sanitizedBody,
    companyName,
    projectAddress,
    publicUrl,
    isLocalhost,
  });

  return {
    subject,
    html,
    text,
    publicPath,
    preheader,
    usesLocalhostOrigin: isLocalhost,
  };
}
