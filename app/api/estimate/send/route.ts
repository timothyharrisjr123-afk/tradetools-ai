import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { KV_ENABLED, setApproval } from "@/app/lib/kv";

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
});

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

function buildBody(meta: z.infer<typeof MetaSchema>) {
  const customerName = (meta.customerName || "").trim() || "there";
  const lines: string[] = [];

  lines.push(`Hi ${customerName},`);
  lines.push("");
  lines.push(`Attached is your ${meta.selectedTier} roofing estimate.`);
  lines.push("");
  lines.push("Project Address:");
  const addrLine1 = (meta.jobAddress1 || "").trim();
  const city = (meta.jobCity || "").trim();
  const state = (meta.jobState || "").trim();
  const zip = (meta.jobZip || "").trim();
  const cityStateZip = [city, state, zip].filter(Boolean).join(", ");
  lines.push(addrLine1 || "(not provided)");
  lines.push(cityStateZip || "");
  lines.push("");
  lines.push("Total Investment:");
  lines.push(formatPrice(meta.suggestedPrice));
  lines.push("");
  lines.push("Scope Summary:");
  lines.push((meta.packageDescription || "").trim() || "(see attached PDF)");
  lines.push("");
  const scheduleCta = (meta.scheduleCta || "").trim();
  if (scheduleCta && !/Reply\s+APPROVE|To approve,\s*please contact us/i.test(scheduleCta)) {
    lines.push(scheduleCta);
    lines.push("");
  }
  lines.push("This estimate is valid for 30 days from the date issued.");
  lines.push("");
  lines.push("If you have any questions, feel free to reply directly to this email.");
  lines.push("");
  lines.push("Thank you,");
  const companyName = (meta.companyName || "").trim();
  lines.push(companyName || "");

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

    const { to, meta, pdfBase64, pdfFilename, savedEstimateId, contractorEmail } =
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

    let origin = req.headers.get("origin") || "http://localhost:3000";
    try {
      const ref = req.headers.get("referer");
      if (ref) origin = new URL(ref).origin;
    } catch {
      /* ignore */
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    let approvalToken: string | null | undefined;
    const jobAddressParts = [
      meta.jobAddress1,
      [meta.jobCity, meta.jobState, meta.jobZip].filter(Boolean).join(", "),
    ].filter(Boolean);
    const jobAddress = jobAddressParts.join(", ") || undefined;

    if (savedEstimateId && contractorEmail) {
      if (KV_ENABLED) {
        approvalToken = crypto.randomUUID();
        await setApproval({
          token: approvalToken,
          status: "sent",
          createdAt: new Date().toISOString(),
          savedEstimateId,
          contractorEmail,
          customerName: meta.customerName,
          customerEmail: toEmail,
          jobAddress,
        });
      } else {
        approvalToken = undefined;
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "[estimate/send] Approval links disabled: KV_REST_API_URL and KV_REST_API_TOKEN are not set. Email sent without Approve link."
          );
        }
      }
    }

    const approveUrl = approvalToken ? `${baseUrl}/approve/${approvalToken}` : null;
    if (typeof console !== "undefined" && console.log) {
      console.log("[estimate/send]", { kvEnabled: KV_ENABLED, approvalToken: approvalToken ?? null, approveUrl });
    }

    const from =
      process.env.RESEND_FROM || "Onboarding <onboarding@resend.dev>";
    const subject = buildSubject(meta);
    const bodyText = buildBody(meta);
    const bodyHtml = approveUrl
      ? `${bodyText.split("\n").join("<br />")}<br /><br /><p style="margin-top:1.5em;">To approve, click the button below.</p><p style="margin-top:0.5em;"><a href="${approveUrl}" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Approve</a></p><p style="margin-top:1em;font-size:0.9em;color:#666;">Payment is handled separately with your contractor.</p>`
      : `${bodyText.split("\n").join("<br />")}<br /><br /><p style="margin-top:1.5em;font-size:0.9em;color:#666;">To approve, please contact us to confirm scheduling.</p>`;

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
      approveUrl,
      kvEnabled: KV_ENABLED,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
