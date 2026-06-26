/**
 * R18D3B — Pure transactional proposal email template (HTML + text).
 *
 * No Resend, routes, lifecycle mutation, PDF, Sign, or Payment language.
 */

import { buildPublicProposalReviewUrl } from "@/app/lib/proposalPublicReviewReadiness";

export const PROPOSAL_EMAIL_CTA_LABEL = "View your proposal";

export type BuildProposalEmailTemplateInput = {
  origin: string;
  rawToken: string;
  subject: string;
  body: string;
  companyName?: string | null;
};

export type ProposalEmailTemplate = {
  subject: string;
  html: string;
  text: string;
  publicPath: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
      return `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#374151;">${lines}</p>`;
    })
    .join("");
}

export function buildProposalEmailTemplate(
  input: BuildProposalEmailTemplateInput
): ProposalEmailTemplate {
  const origin = input.origin.trim().replace(/\/$/, "");
  const rawToken = input.rawToken.trim();
  const publicUrl = buildPublicProposalReviewUrl(origin, rawToken);
  const publicPath = `/p/${encodeURIComponent(rawToken)}`;
  const subject = input.subject.trim();
  const body = input.body.trim();
  const companyName = (input.companyName ?? "").trim() || "Your contractor";

  const htmlBody = bodyToHtmlParagraphs(body);
  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#0891b2;font-weight:700;">Proposal</div>
        <div style="margin-top:8px;font-size:22px;line-height:1.2;font-weight:700;color:#111827;">${escapeHtml(companyName)}</div>
      </div>
      <div style="padding:24px;">
        ${htmlBody}
        <p style="margin:0 0 20px 0;">
          <a href="${escapeHtml(publicUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">${PROPOSAL_EMAIL_CTA_LABEL}</a>
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">If the button does not work, copy and paste this link into your browser:<br /><span style="word-break:break-all;color:#374151;">${escapeHtml(publicUrl)}</span></p>
      </div>
    </div>
  </body>
</html>`;

  const textParts = [body, "", PROPOSAL_EMAIL_CTA_LABEL, publicUrl, "", companyName].filter(
    (part, index) => index < 2 || part.length > 0
  );

  return {
    subject,
    html,
    text: textParts.join("\n"),
    publicPath,
  };
}
