import { NextResponse } from "next/server";
import { Resend } from "resend";

const BodySchema = {
  to: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  subject: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  message: (v: unknown) => typeof v === "string",
  approveUrl: (v: unknown) => v == null || typeof v === "string",
};

function normalizeEmail(toRaw: string): string | null {
  const trimmed = (toRaw || "").trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  const extracted = angleMatch?.[1]?.trim() || trimmed;
  if (!extracted || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extracted)) return null;
  return extracted;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const to = typeof json?.to === "string" ? json.to.trim() : "";
    const subject = typeof json?.subject === "string" ? json.subject.trim() : "";
    const message = typeof json?.message === "string" ? json.message : "";
    const approveUrl = json?.approveUrl != null ? String(json.approveUrl) : "";

    if (!BodySchema.to(to) || !BodySchema.subject(subject) || !BodySchema.message(message)) {
      return NextResponse.json(
        { success: false, error: "Invalid request body. Need to, subject, message." },
        { status: 400 }
      );
    }

    const toEmail = normalizeEmail(to);
    if (!toEmail) {
      return NextResponse.json(
        { success: false, error: "Invalid recipient email." },
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
    const from = process.env.RESEND_FROM || "Onboarding <onboarding@resend.dev>";

    const bodyText = approveUrl
      ? `${message}\n\nView estimate & approve: ${approveUrl}`
      : message;

    const result = await resend.emails.send({
      from,
      to: [toEmail],
      subject,
      text: bodyText,
    });

    if ((result as { error?: { message?: string } })?.error) {
      return NextResponse.json(
        {
          success: false,
          error: (result as { error: { message?: string } }).error?.message || "Email send failed.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
