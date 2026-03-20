import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { putApprovalRecord } from "@/app/lib/kv";

const EmailSchema = z.string().email();

const MetaSchema = z.object({
  customerName: z.string().optional(),
  selectedTier: z.enum(["Core", "Enhanced", "Premium"]),
  jobAddress1: z.string().optional(),
  jobCity: z.string().optional(),
  jobState: z.string().optional(),
  jobZip: z.string().optional(),
  suggestedPrice: z.number(),
  packageDescription: z.string().optional(),
  scheduleCta: z.string().optional(),
  companyName: z.string().optional(),
});

const BodySchema = z.object({
  to: z.string(),
  meta: MetaSchema,
  pdfBase64: z.string().min(50),
  pdfFilename: z.string().min(1).default("estimate.pdf"),
  savedEstimateId: z.string().uuid().optional(),
  contractorEmail: z.string().email().optional(),
  approvalToken: z.string().uuid().optional(),
  notifyEmail: z.string().optional(),
});

function isValidEmailLoose(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

function safeUUID() {
  try {
    // @ts-ignore
    return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function getStableOrigin(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "";

  if (envUrl) return envUrl.replace(/\/$/, "");

  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  if (host) return `${proto}://${host}`.replace(/\/$/, "");

  return "http://localhost:3000";
}

function normalizeEmail(toRaw: string) {
  const trimmed = (toRaw || "").trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  const extracted = angleMatch?.[1]?.trim() || trimmed;
  const parsed = EmailSchema.safeParse(extracted);
  if (!parsed.success) return null;
  return parsed.data;
}

function formatPrice(n: number) {
  return `$${Math.round((n + Number.EPSILON) * 100) / 100}`.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );
}

function buildSubject(meta: z.infer<typeof MetaSchema>) {
  const name = (meta.customerName || "").trim() || "Customer";
  return `Roofing Estimate – ${name} – ${meta.selectedTier}`;
}

function buildBody(meta: z.infer<typeof MetaSchema>, approvalUrl?: string | null) {
  const customerName = (meta.customerName || "").trim() || "there";
  const companyName = (meta.companyName || "").trim() || "Your Company";
  const addrLine1 = (meta.jobAddress1 || "").trim();
  const city = (meta.jobCity || "").trim();
  const state = (meta.jobState || "").trim();
  const zip = (meta.jobZip || "").trim();
  const cityStateZip = [city, state, zip].filter(Boolean).join(", ");
  const total = formatPrice(meta.suggestedPrice);
  const packageDescription = (meta.packageDescription || "").trim() || "(see attached PDF)";
  const scheduleCta = (meta.scheduleCta || "").trim();
  const isApprovalStyleCta = /reply\s*['"]?\s*approve\s*['"]?|approve.*below|click.*approve|use the button/i.test(scheduleCta);

  const lines: string[] = [];
  lines.push(`Hi ${customerName},`);
  lines.push("");
  lines.push("Your roofing estimate is ready.");
  lines.push("");
  lines.push(`Package: ${meta.selectedTier}`);
  lines.push(`Total Investment: ${total}`);
  lines.push("");
  lines.push("Project Address:");
  lines.push(addrLine1 || "(not provided)");
  if (cityStateZip) lines.push(cityStateZip);
  lines.push("");
  lines.push("Scope Summary:");
  lines.push(packageDescription);
  lines.push("");

  if (scheduleCta && !isApprovalStyleCta) {
    lines.push(scheduleCta);
    lines.push("");
  }

  if (approvalUrl) {
    lines.push("Approve your estimate:");
    lines.push(approvalUrl);
    lines.push("");
    lines.push("Use the approval button to confirm and we'll reach out to schedule your start date.");
    lines.push("");
  }

  lines.push("This estimate is valid for 30 days from the date issued.");
  lines.push("");
  lines.push("Questions? Reply directly to this email and we'll help right away.");
  lines.push("");
  lines.push("Thank you,");
  lines.push(companyName);

  return lines.join("\n");
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, meta, pdfBase64, pdfFilename, savedEstimateId, contractorEmail, approvalToken: clientToken, notifyEmail: notifyEmailBody } =
      parsed.data;

    const toEmail = normalizeEmail(to);
    if (!toEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid recipient email. Use format email@example.com (or Name <email@example.com>).",
        },
        { status: 422 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing RESEND_API_KEY on server." },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    if (!pdfBuffer || pdfBuffer.length < 200) {
      return NextResponse.json(
        { success: false, error: "PDF payload is invalid or too small." },
        { status: 400 }
      );
    }

    const origin = getStableOrigin(req);

    const approvalToken =
      (clientToken && String(clientToken).trim()) || safeUUID();
    const approvalUrl = `${origin}/approve/${approvalToken}`;

    const jobAddressParts = [
      meta.jobAddress1,
      [meta.jobCity, meta.jobState, meta.jobZip].filter(Boolean).join(", "),
    ].filter(Boolean);
    const jobAddressLine = jobAddressParts.join(", ") || undefined;

    const notifyEmailRaw = (notifyEmailBody && String(notifyEmailBody).trim()) || "";
    const notifyEmail = isValidEmailLoose(notifyEmailRaw) ? notifyEmailRaw : null;
    try {
      await putApprovalRecord({
        token: approvalToken,
        estimateId: savedEstimateId ?? undefined,
        createdAt: new Date().toISOString(),
        customerName: meta.customerName ?? null,
        customerEmail: toEmail ?? null,
        addressLine: jobAddressLine || null,
        total: typeof meta.suggestedPrice === "number" ? meta.suggestedPrice : null,
        tierLabel: meta.selectedTier ?? null,
        notifyEmail: notifyEmail ?? null,
      });
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[estimate/send] KV approval write failed", e);
      }
    }

    if (typeof console !== "undefined" && console.log) {
      console.log("[estimate/send]", { approvalToken, approvalUrl });
    }

    const approveBlockText = `\n\nAPPROVAL LINK:\n${approvalUrl}\n`;

    const from =
      process.env.RESEND_FROM || "Onboarding <onboarding@resend.dev>";
    const subject = buildSubject(meta);
    const baseText = buildBody(meta, approvalUrl);

    const customerName = (meta.customerName || "").trim() || "there";
    const companyName = (meta.companyName || "").trim() || "Your Company";
    const tierLabel = (meta.selectedTier || "").trim();
    const addrLine1 = (meta.jobAddress1 || "").trim();
    const city = (meta.jobCity || "").trim();
    const state = (meta.jobState || "").trim();
    const zip = (meta.jobZip || "").trim();
    const cityStateZip = [city, state, zip].filter(Boolean).join(", ");
    const totalFormatted = formatPrice(meta.suggestedPrice);
    const packageDescription = (meta.packageDescription || "").trim() || "(see attached PDF)";
    const scheduleCta = (meta.scheduleCta || "").trim();
    const isApprovalStyleCta = /reply\s*['"]?\s*approve\s*['"]?|approve.*below|click.*approve|use the button/i.test(scheduleCta);

    const bodyText = `${baseText}${approveBlockText}`;

    const bodyHtml = `
      <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
          
          <div style="padding:20px 24px; border-bottom:1px solid #e5e7eb; background:#ffffff;">
            <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#0891b2; font-weight:700;">
              Roofing Estimate
            </div>
            <div style="margin-top:8px; font-size:24px; line-height:1.2; font-weight:700; color:#111827;">
              ${companyName}
            </div>
          </div>

          <div style="padding:24px;">
            <p style="margin:0 0 14px 0; font-size:14px; line-height:1.7; color:#111827;">
              Hi ${customerName},
            </p>

            <p style="margin:0 0 18px 0; font-size:14px; line-height:1.7; color:#374151;">
              Your roofing estimate is ready. Review the details below and approve when you're ready to move forward.
            </p>

            <div style="margin:0 0 18px 0; padding:16px; border-radius:14px; background:#f8fafc; border:1px solid #e5e7eb;">
              <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Package</div>
              <div style="font-size:15px; font-weight:600; color:#111827; margin-bottom:14px;">${tierLabel}</div>

              <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Project Address</div>
              <div style="font-size:14px; line-height:1.6; color:#111827; margin-bottom:14px;">
                ${addrLine1 || "(not provided)"}${cityStateZip ? `<br />${cityStateZip}` : ""}
              </div>

              <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Total Investment</div>
              <div style="font-size:30px; font-weight:800; line-height:1.1; color:#059669;">
                ${totalFormatted}
              </div>
            </div>

            <div style="margin:0 0 18px 0;">
              <div style="font-size:12px; color:#6b7280; margin-bottom:8px;">Scope Summary</div>
              <div style="font-size:14px; line-height:1.7; color:#374151;">
                ${packageDescription}
              </div>
            </div>

            ${scheduleCta && !isApprovalStyleCta
              ? `
            <div style="margin:0 0 18px 0; font-size:14px; line-height:1.7; color:#374151;">
              ${scheduleCta}
            </div>`
              : ""}

            <div style="margin:22px 0 18px 0; text-align:center;">
              <div style="margin:0 0 10px 0; font-size:14px; line-height:1.6; color:#374151;">
                Use the button below to approve your estimate.
              </div>
              <a
                href="${approvalUrl}"
                style="display:inline-block; padding:14px 22px; border-radius:10px; text-decoration:none; font-weight:700; font-size:14px; background:#10b981; color:#052e16;"
              >
                Approve Estimate
              </a>
            </div>

            <div style="margin:0 0 18px 0; padding:14px 16px; border-radius:12px; background:#ecfdf5; border:1px solid #a7f3d0;">
              <div style="font-size:13px; font-weight:600; color:#065f46; margin-bottom:6px;">
                What happens next
              </div>
              <div style="font-size:13px; line-height:1.7; color:#065f46;">
                Once approved, we'll reach out to schedule your start date.
              </div>
            </div>

            <div style="font-size:11px; line-height:1.6; color:#9ca3af; margin-top:16px;">
              Backup link if the button does not open:<br />
              <span style="word-break:break-all; color:#6b7280; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                ${approvalUrl}
              </span>
            </div>
          </div>

          <div style="padding:16px 24px; border-top:1px solid #e5e7eb; background:#fafafa;">
            <div style="font-size:12px; line-height:1.7; color:#6b7280;">
              This estimate is valid for 30 days from the date issued.<br />
              Questions? Reply directly to this email and we'll help right away.
            </div>
          </div>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from,
      to: [toEmail],
      subject,
      text: bodyText,
      html: bodyHtml,
      attachments: [
        {
          filename: pdfFilename.endsWith(".pdf")
            ? pdfFilename
            : `${pdfFilename}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if ((result as any)?.error) {
      return NextResponse.json(
        {
          success: false,
          error:
            (result as any).error?.message || "Email send failed.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      approvalToken: approvalToken ?? null,
      approvalUrl: approvalUrl ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
