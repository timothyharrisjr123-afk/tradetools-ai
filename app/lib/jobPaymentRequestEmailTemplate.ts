/**
 * Phase 11 — customer payment-request email template (HTML + text).
 * Communication only. No due/overdue language. No FieldDive receipt claims.
 */

import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import { escapeHtml, isLocalhostPublicOrigin } from "@/app/lib/proposalEmailTemplate";
import { buildPublicProposalReviewUrl } from "@/app/lib/proposalPublicReviewReadiness";
import type { JobPaymentKind } from "@/app/lib/jobPaymentTypes";

export const PAYMENT_REQUEST_EMAIL_CTA_LABEL = "Pay now";

export function paymentRequestKindEmailLabel(kind: JobPaymentKind | string): string {
  const k = String(kind).trim().toLowerCase();
  if (k === "deposit") return "Deposit";
  if (k === "progress") return "Progress payment";
  if (k === "balance") return "Balance";
  return "Payment";
}

export function formatPaymentRequestEmailAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export type BuildPaymentRequestEmailTemplateInput = {
  origin: string;
  rawToken: string;
  companyName: string | null;
  customerName?: string | null;
  projectAddress?: string | null;
  kind: JobPaymentKind | string;
  amountCents: number;
  contractorNote?: string | null;
  contractTotalCents?: number | null;
  remainingCollectibleCents?: number | null;
};

export type PaymentRequestEmailTemplate = {
  subject: string;
  html: string;
  text: string;
  publicPath: string;
  preheader: string;
  usesLocalhostOrigin: boolean;
};

export function buildPaymentRequestEmailTemplate(
  input: BuildPaymentRequestEmailTemplateInput
): PaymentRequestEmailTemplate {
  const company = (input.companyName ?? "").trim() || "Your contractor";
  const kindLabel = paymentRequestKindEmailLabel(input.kind);
  const amount = formatPaymentRequestEmailAmount(input.amountCents);
  const address = (input.projectAddress ?? "").trim();
  const customer = (input.customerName ?? "").trim();
  const note = (input.contractorNote ?? "").trim();
  const publicUrl = buildPublicProposalReviewUrl(input.origin, input.rawToken);
  const publicPath = new URL(publicUrl).pathname;
  const usesLocalhostOrigin = isLocalhostPublicOrigin(input.origin);

  const subject = `${company}: ${kindLabel} of ${amount} requested`;
  const preheader = address
    ? `${kindLabel} of ${amount} for ${address.split(",")[0]?.trim() || address}.`
    : `${kindLabel} of ${amount} is ready to pay.`;

  const greeting = customer
    ? `Hi ${customer.split(/\s+/)[0]},`
    : "Hello,";

  const contextLines: string[] = [];
  if (address) contextLines.push(`Property: ${address}`);
  contextLines.push(`${kindLabel}: ${amount}`);
  if (
    typeof input.contractTotalCents === "number" &&
    Number.isInteger(input.contractTotalCents) &&
    input.contractTotalCents >= 0
  ) {
    contextLines.push(
      `Current contract total: ${formatPaymentRequestEmailAmount(input.contractTotalCents)}`
    );
  }
  if (
    typeof input.remainingCollectibleCents === "number" &&
    Number.isInteger(input.remainingCollectibleCents) &&
    input.remainingCollectibleCents >= 0
  ) {
    contextLines.push(
      `Remaining balance: ${formatPaymentRequestEmailAmount(input.remainingCollectibleCents)}`
    );
  }

  const textParts = [
    greeting,
    "",
    `${company} requested a ${kindLabel.toLowerCase()} of ${amount}.`,
    ...contextLines,
    "",
    note ? `Note from ${company}:\n${note}\n` : "",
    `Pay securely: ${publicUrl}`,
    "",
    "If you already paid, you can ignore this message.",
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));

  const text = textParts.join("\n");

  const accent = PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
        <tr><td style="padding:28px 24px 8px;">
          <p style="margin:0 0 4px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">${escapeHtml(company)}</p>
          <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;">${escapeHtml(kindLabel)} requested</h1>
        </td></tr>
        <tr><td style="padding:8px 24px 0;">
          <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(company)} requested a ${escapeHtml(kindLabel.toLowerCase())} of <strong>${escapeHtml(amount)}</strong>.</p>
          <table role="presentation" width="100%" style="margin:0 0 20px;border-collapse:collapse;">
            ${contextLines
              .map(
                (line) =>
                  `<tr><td style="padding:4px 0;font-size:14px;color:#334155;">${escapeHtml(line)}</td></tr>`
              )
              .join("")}
          </table>
          ${
            note
              ? `<p style="margin:0 0 20px;padding:12px 14px;background:#f8fafc;border-radius:6px;font-size:14px;line-height:1.45;color:#334155;"><strong>Note:</strong> ${escapeHtml(note)}</p>`
              : ""
          }
          <p style="margin:0 0 28px;">
            <a href="${escapeHtml(publicUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:6px;">${PAYMENT_REQUEST_EMAIL_CTA_LABEL}</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:1.45;color:#64748b;">If you already paid, you can ignore this message.</p>
        </td></tr>
        <tr><td style="padding:24px;font-size:12px;color:#94a3b8;">Sent by FieldDive on behalf of ${escapeHtml(company)}.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    text,
    publicPath,
    preheader,
    usesLocalhostOrigin,
  };
}
