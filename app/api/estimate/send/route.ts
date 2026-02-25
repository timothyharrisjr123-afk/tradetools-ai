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
  approvalToken: z.string().uuid().optional(),
});

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
  if (approvalUrl) {
    lines.push("Approve your estimate:");
    lines.push(approvalUrl);
    lines.push("");
    lines.push("Once you approve, we'll contact you to schedule your start date.");
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

    const { to, meta, pdfBase64, pdfFilename, savedEstimateId, contractorEmail, approvalToken: clientToken } =
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
    const jobAddress = jobAddressParts.join(", ") || undefined;
    const jobAddressLine = jobAddressParts.join(", ") || undefined;

    if (savedEstimateId && contractorEmail && KV_ENABLED) {
      const createdAt = new Date().toISOString();
      const publicSnapshot = {
        token: approvalToken,
        status: "sent_pending" as const,
        createdAt,
        savedEstimateId,
        contractorEmail,
        customerName: meta.customerName,
        customerEmail: toEmail,
        jobAddress,
        company: {
          name: (meta as any).companyName?.trim?.(),
          phone: (meta as any).companyPhone?.trim?.(),
          email: contractorEmail,
        },
        customer: { name: (meta.customerName || "").trim() || undefined, email: toEmail },
        job: { addressLine: jobAddressLine },
        tierLabel: meta.selectedTier,
        totalFormatted: formatPrice(meta.suggestedPrice),
        packageDescription: (meta.packageDescription || "").trim() || undefined,
        scheduleCta: (meta.scheduleCta || "").trim() || undefined,
      };
      await setApproval(publicSnapshot);
    } else if (savedEstimateId && contractorEmail && typeof console !== "undefined" && console.warn) {
      console.warn(
        "[estimate/send] KV not configured. Approval link included but /approve page will not find record until KV is set."
      );
    }

    if (typeof console !== "undefined" && console.log) {
      console.log("[estimate/send]", { kvEnabled: KV_ENABLED, approvalToken, approvalUrl });
    }

    const approveBlockHtml = `
    <div style="margin: 22px 0 10px 0; padding: 14px 16px; border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; background: rgba(255,255,255,0.04);">
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 10px;">Approval</div>
      <a href="${approvalUrl}"
         style="display:inline-block; padding: 10px 14px; border-radius: 12px; text-decoration:none; font-weight:700;
                background:#10b981; color:#071a13;">
        Approve Estimate
      </a>
      <div style="font-size:12px; opacity:0.75; margin-top:10px;">
        Or copy/paste this link: <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${approvalUrl}</span>
      </div>
    </div>
  `;
    const approveBlockText = `\n\nAPPROVAL LINK:\n${approvalUrl}\n`;

    const from =
      process.env.RESEND_FROM || "Onboarding <onboarding@resend.dev>";
    const subject = buildSubject(meta);
    const baseText = buildBody(meta, approvalUrl);
    const baseHtml = baseText.split("\n").join("<br />");
    const bodyText = `${baseText}${approveBlockText}`;
    const bodyHtml = `${baseHtml}${approveBlockHtml}`;

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
