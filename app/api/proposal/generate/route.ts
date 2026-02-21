import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TierSchema = z.enum(["standard", "enhanced", "premium"]);

const ContextSchema = z
  .object({
    companyName: z.string().optional(),
    includeTearOff: z.boolean().optional(),
    tearOffType: z.string().optional(),
    scopeBullets: z.array(z.string()).optional(),
  })
  .optional();

const VoiceProfileSchema = z
  .object({
    tone: z.enum(["professional", "friendly", "direct", "premium"]).default("professional"),
    styleNotes: z.string().optional(),
  })
  .optional();

const JobContextSchema = z
  .object({
    zip: z.string().optional(),
    hasAddress: z.boolean().optional(),
    hasCustomerEmail: z.boolean().optional(),
    roofAreaSqFt: z.number().optional(),
    squares: z.number().optional(),
    adjustedSquares: z.number().optional(),
    pitch: z.string().optional(),
    stories: z.string().optional(),
    complexity: z.string().optional(),
    laborMode: z.string().optional(),
    tearOffEnabled: z.boolean().optional(),
    removalType: z.string().nullable().optional(),
    voiceTone: z.string().optional(),
    styleNotes: z.string().optional(),
    tierLabel: z.string().optional(),
    feedbackBias: z.enum(["more_confident", "simpler_clearer"]).nullable().optional(),
  })
  .optional();

const BodySchema = z.object({
  tier: TierSchema,
  tierDetails: z.any(),
  context: ContextSchema,
  voiceProfile: VoiceProfileSchema,
  jobContext: JobContextSchema,
});

function assertNoCurrency(text: string) {
  const t = (text || "").toLowerCase();
  if (t.includes("$") || t.includes("usd") || t.includes("dollar") || t.includes("dollars")) {
    throw new Error("AI output contained currency. Regenerate without any prices or dollar amounts.");
  }
}

function tierLabel(tier: z.infer<typeof TierSchema>) {
  return tier === "standard" ? "Core" : tier === "enhanced" ? "Enhanced" : "Premium";
}

function clampText(s: unknown, max = 600): string {
  const t = typeof s === "string" ? s : String(s ?? "");
  return t.length > max ? t.slice(0, max) : t;
}

function safeNum(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : 0;
}

type JobContext = {
  zip?: string;
  hasAddress?: boolean;
  hasCustomerEmail?: boolean;
  roofAreaSqFt?: number;
  squares?: number;
  adjustedSquares?: number;
  pitch?: string;
  stories?: string;
  complexity?: string;
  laborMode?: string;
  tearOffEnabled?: boolean;
  removalType?: string | null;
  voiceTone?: string;
  styleNotes?: string;
  tierLabel?: string;
  feedbackBias?: "more_confident" | "simpler_clearer" | null;
};

function buildJobSignals(ctx: JobContext) {
  const tier = (ctx.tierLabel || "").toString().trim() || "Core";
  const tearOffLine = ctx.tearOffEnabled
    ? `Existing roofing will be fully removed to the deck, allowing inspection of underlying decking and a clean installation per manufacturer and local code.`
    : `New roofing will be installed over the existing layer where permitted by local code.`;

  const complexityBits = [
    ctx.pitch ? `Pitch: ${ctx.pitch}` : null,
    ctx.stories ? `Stories: ${ctx.stories}` : null,
    ctx.complexity ? `Complexity: ${ctx.complexity}` : null,
    ctx.laborMode ? `Labor mode: ${ctx.laborMode}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const sizeBits = [
    ctx.roofAreaSqFt ? `Roof area: ${Math.round(ctx.roofAreaSqFt)} sq ft` : null,
    ctx.adjustedSquares
      ? `Adjusted squares: ${ctx.adjustedSquares.toFixed(2)}`
      : ctx.squares
        ? `Squares: ${ctx.squares.toFixed(2)}`
        : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const ctaMode = ctx.hasCustomerEmail
    ? "Customer email is present (approval is link-only; use: 'To approve, please contact us to confirm scheduling.')."
    : "Customer email missing (CTA should ask for best email/phone to confirm schedule).";

  return {
    tier,
    tearOffLine,
    complexityBits: complexityBits || "Pitch/Stories/Complexity not provided.",
    sizeBits: sizeBits || "Roof size not provided.",
    ctaMode,
  };
}

function tierPositioning(tier: string) {
  const t = (tier || "").toLowerCase();
  if (t.includes("core") || t.includes("standard")) {
    return {
      promise: "clean, code-minded install with the essentials done right",
      emphasis: [
        "efficient install",
        "code-minded details",
        "clean workmanship",
        "solid baseline protection",
      ],
    };
  }
  if (t.includes("enhanced")) {
    return {
      promise: "stronger protection with upgraded components and higher attention to detail",
      emphasis: [
        "upgraded protection",
        "better long-term performance",
        "stronger details",
        "improved durability",
      ],
    };
  }
  return {
    promise: "premium build focused on maximum durability, clean finish, and long-term performance",
    emphasis: [
      "top-tier durability",
      "clean finish",
      "best long-term performance",
      "premium components",
    ],
  };
}

function buildAIMessages(input: {
  tierLabel: string;
  companyName?: string;
  voiceTone?: string;
  styleNotes?: string;
}) {
  const { tierLabel, companyName, voiceTone, styleNotes } = input;
  const pos = tierPositioning(tierLabel);

  const rules = [
    "Output MUST be valid JSON with keys: packageDescription, scheduleCta.",
    "No extra keys. No markdown. No quotes around the whole JSON.",
    "packageDescription: 1–2 sentences, 35–80 words, professional and specific, no fluff.",
    "scheduleCta: 1 short sentence, 6–16 words, MUST be jobsite-friendly (assume contractor is on-site).",
    "Avoid the word 'inspection'. Avoid 'discuss your needs'. Avoid sounding like a template.",
    "Do NOT mention pricing, totals, dollars, margin, financing, or any numbers.",
    "Vary phrasing across runs: avoid starting packageDescription with 'This proposal includes'.",
    "Use active voice. Prefer concrete trade language (install, underlayment, ventilation, flashing, cleanup).",
    "If companyName provided, you may include it once in scheduleCta only (optional).",
  ].join("\n");

  const voice = [
    `Voice tone: ${voiceTone || "Professional, clear, contractor-friendly"}.`,
    styleNotes?.trim() ? `Style notes: ${styleNotes.trim()}` : "",
    `Tier: ${tierLabel}. Positioning: ${pos.promise}.`,
    `Emphasize 1–2 of: ${pos.emphasis.join(", ")}.`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      role: "system" as const,
      content: `You write short, high-quality roofing proposal wording.\n\nRULES:\n${rules}\n\nVOICE:\n${voice}`,
    },
    {
      role: "user" as const,
      content:
        `Write the two fields for a roofing estimate.\n` +
        `Return ONLY JSON.\n` +
        `Keys:\n` +
        `- packageDescription (1–2 sentences)\n` +
        `- scheduleCta (1 sentence)\n\n` +
        `Approval is link-based only (do NOT suggest replying or texting APPROVE). Use: "To approve, please contact us to confirm scheduling."\n\n` +
        `Do NOT use the word "inspection".`,
    },
  ];
}

export type TierDetails = {
  label: string;
  includes: string[];
};

export type ProposalGenerateBody = {
  tier: "standard" | "enhanced" | "premium";
  tierDetails: TierDetails;
  context?: z.infer<typeof ContextSchema>;
};

export type ProposalGenerateResponse = {
  packageDescription: string;
  scheduleCta: string;
};

function stripBannedPricingLanguage(s: string) {
  return (s || "")
    .replace(/\$\s*\d[\d,]*(\.\d+)?/g, "")
    .replace(/\b(price|cost|total|margin|financ(e|ing)|discount|afford\w*)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseJsonResponse(raw: string): ProposalGenerateResponse | null {
  const trimmed = raw.trim();
  const noFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(noFence) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "packageDescription" in parsed &&
      "scheduleCta" in parsed &&
      typeof (parsed as ProposalGenerateResponse).packageDescription === "string" &&
      typeof (parsed as ProposalGenerateResponse).scheduleCta === "string"
    ) {
      return parsed as ProposalGenerateResponse;
    }
  } catch {
    // invalid JSON or shape
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tier, tierDetails, context, voiceProfile, jobContext: jobContextRaw } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "your_key_here") {
      return NextResponse.json(
        { error: "OpenAI API key not configured." },
        { status: 503 }
      );
    }

    const tl = tierLabel(tier);

    let messages: { role: "system" | "user"; content: string }[];
    let jobContext: JobContext | undefined;

    if (jobContextRaw && typeof jobContextRaw === "object") {
      jobContext = {
        zip: clampText(jobContextRaw.zip, 12),
        hasAddress: Boolean(jobContextRaw.hasAddress),
        hasCustomerEmail: Boolean(jobContextRaw.hasCustomerEmail),
        roofAreaSqFt: safeNum(jobContextRaw.roofAreaSqFt),
        squares: safeNum(jobContextRaw.squares),
        adjustedSquares: safeNum(jobContextRaw.adjustedSquares),
        pitch: clampText(jobContextRaw.pitch, 40),
        stories: clampText(jobContextRaw.stories, 40),
        complexity: clampText(jobContextRaw.complexity, 40),
        laborMode: clampText(jobContextRaw.laborMode, 40),
        tearOffEnabled: Boolean(jobContextRaw.tearOffEnabled),
        removalType: jobContextRaw.removalType ? clampText(jobContextRaw.removalType, 40) : null,
        voiceTone: clampText(jobContextRaw.voiceTone, 40),
        styleNotes: clampText(jobContextRaw.styleNotes, 280),
        tierLabel: clampText(jobContextRaw.tierLabel, 40),
        feedbackBias:
          jobContextRaw.feedbackBias === "more_confident" || jobContextRaw.feedbackBias === "simpler_clearer"
            ? jobContextRaw.feedbackBias
            : null,
      };

      const signals = buildJobSignals(jobContext);
      const tierSummary = clampText(
        typeof tierDetails === "string" ? tierDetails : JSON.stringify(tierDetails ?? {}),
        1200
      );

      const systemPrompt = `
You are writing TWO short lines of professional roofing proposal wording.

You MUST output JSON ONLY with keys:
- packageDescription (string)
- scheduleCta (string)

Hard constraints:
- DO NOT mention prices, costs, dollars, totals, margins, financing, discounts, "affordable", or "budget".
- DO NOT invent materials/services not implied by the tier summary or job signals.
- Avoid these words in the CTA: "inspection", "estimate", "quote".
- packageDescription: 1–2 sentences max.
- scheduleCta: 1 sentence max.
- Keep language contractor-professional, clear, and specific.
- Make the wording meaningfully different across Core vs Enhanced vs Premium.
- Use job signals to decide emphasis (tear-off included vs not, complexity, roof size).
- If customer email is missing: CTA asks for best email/phone to confirm schedule. Never instruct "Reply APPROVE"; approval is link-based only.
- If tear-off is NOT included: CTA should prompt confirmation (customers often assume removal is included).
Return valid JSON only (no markdown, no commentary).
`.trim();

      const userPrompt = `
Tier label: ${signals.tier}

Tier summary (features/inclusions):
${tierSummary}

Job signals:
- ${signals.sizeBits}
- ${signals.complexityBits}
- ${signals.tearOffLine}
- ${signals.ctaMode}
ZIP: ${jobContext.zip || "n/a"}

Brand voice:
Tone: ${jobContext.voiceTone || "professional"}
Style notes: ${jobContext.styleNotes || "short, direct, confident; avoid fluff"}

Feedback bias:
${jobContext.feedbackBias === "more_confident" ? "Use stronger, more decisive language." : jobContext.feedbackBias === "simpler_clearer" ? "Keep wording simpler and clearer." : "No feedback bias."}

Write outputs that clearly differ by tier:
- Core: code-compliant, clean install, basics done right.
- Enhanced: stronger protection + upgraded components/process.
- Premium: top-tier system, highest performance/durability/finish, extra detail.

CTA rules (approval is link-based only; do NOT use "Reply APPROVE"):
- If customer email present: use "To approve, please contact us to confirm scheduling." (or if tear-off not included: add "and confirm if tear-off is needed" where appropriate).
- If customer email missing:
  - "Reply with the best email/phone and we'll confirm your start date."
  - If tear-off NOT included, add: "(and confirm if tear-off is needed)"

Now output JSON exactly like:
{ "packageDescription": "...", "scheduleCta": "..." }
`.trim();

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];
    } else {
      const voiceTone =
        voiceProfile?.tone === "direct"
          ? "Direct, short, confident"
          : voiceProfile?.tone === "friendly"
            ? "Friendly, warm, approachable"
            : voiceProfile?.tone === "premium"
              ? "Premium, polished, high-trust"
              : "Professional, clear, contractor-friendly";

      messages = buildAIMessages({
        tierLabel: tl,
        companyName: (context?.companyName || "").trim() || undefined,
        voiceTone,
        styleNotes: (voiceProfile?.styleNotes || "").trim() || undefined,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
      max_tokens: 400,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Empty response from model." },
        { status: 502 }
      );
    }

    const result = parseJsonResponse(text);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid or incomplete JSON from model." },
        { status: 502 }
      );
    }

    const packageDescription = String(result.packageDescription || "").trim();
    const scheduleCta = String(result.scheduleCta || "").trim();

    if (!packageDescription || !scheduleCta) {
      return NextResponse.json(
        { error: "Generate returned missing packageDescription or scheduleCta." },
        { status: 502 }
      );
    }

    assertNoCurrency(packageDescription);
    assertNoCurrency(scheduleCta);

    const safePackageDescription = stripBannedPricingLanguage(packageDescription);
    const safeScheduleCta = stripBannedPricingLanguage(scheduleCta);

    const fallbackPackageDescription = jobContext
      ? jobContext.tearOffEnabled
        ? "Existing roofing will be fully removed to the deck before installation to ensure proper adhesion and long-term performance."
        : "New roofing will be installed over the existing layer where permitted by local code."
      : "Professional roofing installation completed to manufacturer guidelines and local code.";

    const fallbackScheduleCta = jobContext
      ? jobContext.hasCustomerEmail
        ? "To approve, please contact us to confirm scheduling."
        : jobContext.tearOffEnabled
          ? "Reply with the best email or phone and we'll confirm your start date."
          : "Reply with the best email or phone (and confirm if tear-off is required) and we'll confirm your start date."
      : "To approve, please contact us to confirm scheduling.";

    return NextResponse.json({
      packageDescription: safePackageDescription || fallbackPackageDescription,
      scheduleCta: safeScheduleCta || fallbackScheduleCta,
    });
  } catch (err) {
    console.error("[proposal/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Proposal generation failed." },
      { status: 502 }
    );
  }
}
