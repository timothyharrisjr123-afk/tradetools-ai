import { NextRequest, NextResponse } from "next/server";
import {
  PROPOSAL_PUBLIC_OPTION_CHOICE_FAILURE_CODES,
  ProposalPublicOptionChoicePersistenceError,
  ProposalPublicOptionChoiceValidationError,
  type ProposalPublicOptionChoiceFailureCode,
} from "@/app/lib/proposalPublicOptionChoicePersistence";
import { recordProposalPublicOptionChoice } from "@/app/lib/proposalPublicOptionChoiceStore.server";

export const runtime = "nodejs";

const SAFE_ERROR =
  "We could not save that package. Please try again.";

const TOKEN_FAILURE_CODES = new Set<string>([
  "invalid_hash",
  "not_found",
  "revoked",
  "superseded",
  "expired",
  "invalid_version",
  "invalid_binding",
  "proposal_unavailable",
]);

function statusForFailure(code: string): number {
  if (TOKEN_FAILURE_CODES.has(code)) return 404;
  if (code === "choice_locked") return 409;
  return 400;
}

function isKnownFailure(code: string): code is ProposalPublicOptionChoiceFailureCode {
  return (PROPOSAL_PUBLIC_OPTION_CHOICE_FAILURE_CODES as readonly string[]).includes(code);
}

/**
 * Public customer package choice persist.
 * Token is hashed server-side. Company / proposal / version are never trusted
 * from the body. Only an option key leaves the client.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    const optionKey = typeof body?.optionKey === "string" ? body.optionKey : "";

    if (!token.trim()) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code: "invalid_token" },
        { status: 400 }
      );
    }

    if (
      body?.amountCents != null ||
      body?.amount != null ||
      body?.totalCents != null ||
      body?.proposalId != null ||
      body?.companyId != null
    ) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code: "amount_tamper" },
        { status: 400 }
      );
    }

    const result = await recordProposalPublicOptionChoice(token.trim(), optionKey);

    if (!result.ok) {
      const code = isKnownFailure(result.code) ? result.code : "invalid_option_choice";
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code },
        { status: statusForFailure(code) }
      );
    }

    return NextResponse.json({
      ok: true,
      optionKey: result.option_key,
      optionLabel: result.option_label,
      totalCents: result.total_cents,
      idempotentReplay: result.idempotent_replay,
    });
  } catch (error) {
    if (error instanceof ProposalPublicOptionChoiceValidationError) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code: "invalid_token" },
        { status: 400 }
      );
    }
    if (error instanceof ProposalPublicOptionChoicePersistenceError) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code: "internal_error" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, message: SAFE_ERROR, code: "internal_error" },
      { status: 500 }
    );
  }
}
