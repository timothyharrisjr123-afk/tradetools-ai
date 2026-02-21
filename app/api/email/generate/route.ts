import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_INSTRUCTION = `You are writing a short email to a homeowner with a roofing estimate.
Tone: contractor, short, confident. Plain text only (no markdown).
Do NOT change any numbers or totals — copy them exactly from the proposal.
Mention that the PDF estimate is attached (attachment wiring may come later).
Include a company signature block using the provided companyProfile: company name, phone, email, and license number if present.
Output valid JSON only, with exactly two keys: "subject" (string) and "body" (string).`;

export type EmailGenerateBody = {
  proposalText: string;
  proposalData: object;
  companyProfile: object;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EmailGenerateBody;

    if (typeof body?.proposalText !== "string" || !body?.proposalData || !body?.companyProfile) {
      return NextResponse.json(
        { error: "Invalid request: proposalText, proposalData, and companyProfile required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "PASTE_YOUR_REAL_KEY_HERE" || apiKey === "your_key_here") {
      return NextResponse.json(
        { error: "OpenAI API key not configured." },
        { status: 503 }
      );
    }

    const userContent = `Generate an email subject and body.

Proposal text (do not change any numbers):
${body.proposalText}

Proposal data (for context):
${JSON.stringify(body.proposalData, null, 2)}

Company profile (use for signature: name, phone, email, license if present):
${JSON.stringify(body.companyProfile, null, 2)}

Return JSON: { "subject": "...", "body": "..." }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = (() => {
      try {
        const json = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
        return JSON.parse(json) as { subject?: string; body?: string };
      } catch {
        return null;
      }
    })();

    if (!parsed || typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
      return NextResponse.json(
        { error: "Invalid response from model." },
        { status: 502 }
      );
    }

    return NextResponse.json({ subject: parsed.subject, body: parsed.body });
  } catch (err) {
    console.error("[email/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Email generation failed." },
      { status: 500 }
    );
  }
}
