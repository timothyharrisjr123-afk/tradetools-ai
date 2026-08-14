import { NextRequest, NextResponse } from "next/server";
import { PROPOSAL_CUSTOMER_PACKET_REQUEST_API_SUCCESS_MESSAGE } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_REQUEST_INTENTS,
  ProposalCustomerRequestStoreError,
  ProposalCustomerRequestValidationError,
  type ProposalCustomerRequestFailureCode,
  type ProposalCustomerRequestIntent,
} from "@/app/lib/proposalCustomerRequestPersistence";
import { recordProposalCustomerRequest } from "@/app/lib/proposalCustomerRequestStore.server";

export const runtime = "nodejs";

const SAFE_ERROR_MESSAGE =
  "We could not send your request. Please try again or contact the contractor.";

const TOKEN_FAILURE_CODES = new Set<ProposalCustomerRequestFailureCode>([
  "invalid_hash",
  "not_found",
  "revoked",
  "superseded",
  "expired",
  "invalid_version",
  "invalid_binding",
  "proposal_unavailable",
]);

function isIntent(value: unknown): value is ProposalCustomerRequestIntent {
  return (
    typeof value === "string" &&
    (PROPOSAL_CUSTOMER_REQUEST_INTENTS as readonly string[]).includes(value)
  );
}

function statusForFailure(code: ProposalCustomerRequestFailureCode): number {
  if (TOKEN_FAILURE_CODES.has(code)) return 404;
  if (code === "idempotency_conflict") return 409;
  if (code === "option_not_on_version" || code === "option_required") return 400;
  return 400;
}

/**
 * Public customer package request submit.
 * Token is hashed server-side; company/proposal/version never trusted from body.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    const submissionKey =
      typeof body?.submissionKey === "string" ? body.submissionKey : "";

    if (!token.trim()) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "invalid_token" },
        { status: 400 }
      );
    }

    if (!isIntent(body?.intent)) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "invalid_intent" },
        { status: 400 }
      );
    }

    if (!submissionKey.trim()) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "invalid_submission_key" },
        { status: 400 }
      );
    }

    // Explicitly ignore any client-supplied binding overrides.
    const result = await recordProposalCustomerRequest(token, {
      submissionKey,
      intent: body.intent,
      requestedOptionId:
        typeof body?.requestedOptionId === "string" ? body.requestedOptionId : null,
      message: typeof body?.message === "string" ? body.message : null,
      customerName: typeof body?.customerName === "string" ? body.customerName : null,
      customerEmail: typeof body?.customerEmail === "string" ? body.customerEmail : null,
      customerPhone: typeof body?.customerPhone === "string" ? body.customerPhone : null,
      payloadJson: {
        source: "public_packet",
        // Never echo company_id / proposal_id / proposal_version_id from client.
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: result.code },
        { status: statusForFailure(result.code) }
      );
    }

    return NextResponse.json({
      ok: true,
      requestId: result.request_id,
      intent: result.intent,
      status: result.status,
      requestedOptionLabel: result.requested_option_label,
      message: PROPOSAL_CUSTOMER_PACKET_REQUEST_API_SUCCESS_MESSAGE,
    });
  } catch (error) {
    if (error instanceof ProposalCustomerRequestValidationError) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR_MESSAGE, code: "invalid_request" },
        { status: 400 }
      );
    }

    if (error instanceof ProposalCustomerRequestStoreError) {
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
