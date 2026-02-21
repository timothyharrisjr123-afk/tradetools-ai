import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const EmailSchema = z.string().email();

const BodySchema = z.object({
  to: z.string(),
  subject: z.string().min(1),
  bodyText: z.string().min(1),

  // PDF as base64 (no data: prefix)
  pdfBase64: z.string().min(50),
  pdfFilename: z.string().min(1).default("estimate.pdf"),
});

function normalizeEmail(toRaw: string) {
  // Accept either:
  // - "email@example.com"
  // - "Name <email@example.com>"
  const trimmed = (toRaw || "").trim();

  const angleMatch = trimmed.match(/<([^>]+)>/);
  const extracted = angleMatch?.[1]?.trim() || trimmed;

  // Validate extracted email
  const parsed = EmailSchema.safeParse(extracted);
  if (!parsed.success) return null;
  return parsed.data;
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

    const { to, subject, bodyText, pdfBase64, pdfFilename } = parsed.data;

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

    // Decode base64 -> Buffer
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    if (!pdfBuffer || pdfBuffer.length < 200) {
      return NextResponse.json(
        { success: false, error: "PDF payload is invalid or too small." },
        { status: 400 }
      );
    }

    // IMPORTANT: Set a verified sender domain in Resend
    // If you already have this elsewhere, match it.
    const from = process.env.RESEND_FROM || "Onboarding <onboarding@resend.dev>";

    const result = await resend.emails.send({
      from,
      to: [toEmail],
      subject,
      text: bodyText,
      attachments: [
        {
          filename: pdfFilename.endsWith(".pdf") ? pdfFilename : `${pdfFilename}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Resend returns either data or error; normalize for UI
    if ((result as any)?.error) {
      return NextResponse.json(
        { success: false, error: (result as any).error?.message || "Email send failed." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
