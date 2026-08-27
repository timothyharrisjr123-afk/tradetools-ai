import { NextRequest, NextResponse } from "next/server";
import {
  ProposalSignaturePersistenceError,
  ProposalSignatureValidationError,
} from "@/app/lib/proposalSignaturePersistence";
import { proposalSignatureMarkError, assertProposalSignatureMark } from "@/app/lib/proposalSignatureMark";
import { recordProposalSignature } from "@/app/lib/proposalSignatureStore.server";
import { openCanonicalDepositFromAcceptedProposal } from "@/app/lib/jobPaymentAcceptanceObligation.server";
import { formatProposalCustomerAcceptedOnLabel } from "@/app/lib/proposalCustomerPacketViewModel";

export const runtime = "nodejs";

const SAFE_ERROR_MESSAGE =
  "We could not sign this proposal. Please try again or contact the contractor.";

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
 * Public Accept & sign / Sign proposal submit.
 * Token is hashed server-side. Signature never moves Job stage.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    const signerPrintedName =
      typeof body?.signerPrintedName === "string" ? body.signerPrintedName : "";
    const signerEmail =
      typeof body?.signerEmail === "string" ? body.signerEmail : null;
    const drawnMark = body?.drawnMark;
    const acknowledged = body?.acknowledged === true;

    if (!token.trim()) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "invalid_token" },
        { status: 400 }
      );
    }
    if (!acknowledged) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "acknowledgement_required" },
        { status: 400 }
      );
    }
    const markCode = proposalSignatureMarkError(drawnMark);
    if (markCode) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: markCode },
        { status: 400 }
      );
    }
    assertProposalSignatureMark(drawnMark);

    const result = await recordProposalSignature(token, {
      signerPrintedName,
      signerEmail,
      drawnMark,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: result.code },
        { status: statusForFailure(result.code) }
      );
    }

    const deposit = await openCanonicalDepositFromAcceptedProposal({
      companyId: result.company_id,
      acceptanceId: result.acceptance_id,
    });
    if (!deposit.ok) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: deposit.code },
        { status: deposit.code === "conflicting_request" ? 409 : 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      signedAt: result.signed_at,
      acceptedAt: result.accepted_at,
      signedOnLabel: formatProposalCustomerAcceptedOnLabel(result.signed_at),
      acceptedOnLabel: formatProposalCustomerAcceptedOnLabel(result.accepted_at),
      signerPrintedName: result.signer_printed_name,
      acceptedOptionLabel: result.accepted_option_label,
      acceptedTotalCents: result.accepted_total_cents,
      idempotentReplay: result.idempotent_replay,
    });
  } catch (error) {
    if (error instanceof ProposalSignatureValidationError) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "invalid_payload" },
        { status: 400 }
      );
    }
    if (error instanceof ProposalSignaturePersistenceError) {
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
