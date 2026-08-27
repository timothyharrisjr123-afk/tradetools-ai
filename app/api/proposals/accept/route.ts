import { NextRequest, NextResponse } from "next/server";
import {
  ProposalAcceptancePersistenceError,
  ProposalAcceptanceValidationError,
} from "@/app/lib/proposalAcceptancePersistence";
import { recordProposalAcceptance } from "@/app/lib/proposalAcceptanceStore.server";
import { openJobDepositFromAcceptanceViaAdmin } from "@/app/lib/proposalPaymentTermsPersistence";

export const runtime = "nodejs";

const SAFE_ERROR_MESSAGE =
  "We could not accept this proposal. Please try again or contact the contractor.";

const TOKEN_FAILURE_CODES = new Set([
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
  if (code === "idempotency_conflict") return 409;
  return 400;
}

/**
 * Public formal acceptance submit.
 * Token is hashed server-side; company/proposal/version never trusted from body.
 * `optionKey` is a frozen option key only. The server resolves it against the
 * token's bound version and reads the total from frozen truth — no client price.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";

    if (!token.trim()) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "invalid_token" },
        { status: 400 }
      );
    }

    if (body?.amountCents != null || body?.amount != null || body?.totalCents != null) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "amount_tamper" },
        { status: 400 }
      );
    }

    const result = await recordProposalAcceptance(token, {
      acceptedByName:
        typeof body?.acceptedByName === "string" ? body.acceptedByName : null,
      acceptedByEmail:
        typeof body?.acceptedByEmail === "string" ? body.acceptedByEmail : null,
      customerOptionKey:
        typeof body?.optionKey === "string" ? body.optionKey : null,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: result.code },
        { status: statusForFailure(result.code) }
      );
    }

    const deposit = await openJobDepositFromAcceptanceViaAdmin({
      companyId: result.company_id,
      acceptanceId: result.acceptance_id,
    });
    if (!deposit.ok) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: deposit.code },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      acceptedAt: result.accepted_at,
      acceptedOptionLabel:
        result.customer_chosen_option_label ?? result.accepted_option_label,
      acceptedTotalCents: result.contract_total_cents,
      customerChoseOption: result.customer_chosen_option_id != null,
      idempotentReplay: result.idempotent_replay,
    });
  } catch (error) {
    if (error instanceof ProposalAcceptanceValidationError) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "invalid_payload" },
        { status: 400 }
      );
    }
    if (error instanceof ProposalAcceptancePersistenceError) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "internal_error" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, message: SAFE_ERROR_MESSAGE, code: "internal_error" },
      { status: 500 }
    );
  }
}
