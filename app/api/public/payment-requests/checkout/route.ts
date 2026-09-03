import { NextRequest, NextResponse } from "next/server";
import { openHostedCheckoutForRequest } from "@/app/lib/jobPaymentCheckout.server";
import { publicCheckoutShouldOpenCanonicalDeposit } from "@/app/lib/jobPaymentCustomerPresenter";
import { resolvePublicJobPaymentCheckoutViaRpc } from "@/app/lib/jobPaymentPersistence";
import { appOriginFromRequest, withPaymentReturnHint } from "@/app/lib/jobPaymentStripe.server";
import {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  isPublicAppOriginError,
} from "@/app/lib/publicAppOrigin.server";
import { recordProposalAcceptance } from "@/app/lib/proposalAcceptanceStore.server";
import { hashProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenHash";
import { openCanonicalDepositFromAcceptedProposal } from "@/app/lib/jobPaymentAcceptanceObligation.server";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";

const SAFE_ERROR =
  "We could not start this payment. Please try again or contact the contractor.";

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

async function loadCheckoutRequestSnapshots(input: {
  companyId: string;
  jobId: string;
}): Promise<
  {
    kind: string;
    status: string;
    proposal_version_id: string;
    proposal_acceptance_id: string;
    requested_at: string;
  }[]
> {
  try {
    const { data, error } = await createAdminClient()
      .from("job_payment_requests")
      .select("kind,status,proposal_version_id,proposal_acceptance_id,requested_at")
      .eq("company_id", input.companyId)
      .eq("job_id", input.jobId)
      .order("requested_at", { ascending: true });
    if (error || !data) return [];
    return data as {
      kind: string;
      status: string;
      proposal_version_id: string;
      proposal_acceptance_id: string;
      requested_at: string;
    }[];
  } catch {
    return [];
  }
}

/**
 * Public Checkout for a payment request bound to the proposal token.
 * Existing open|processing requests (progress/balance/deposit) resolve first.
 * Deposit mint happens on `not_found`, or on `not_payable` only for failed-deposit retry.
 * Failed progress/balance never invoke the deposit helper.
 * Amount, account, and binding are server-owned.
 *
 * `optionKey` carries the customer's chosen frozen package. It is a stable
 * option key only — the server resolves it against the token's bound version
 * and derives the deposit from frozen truth. No client price authority.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    if (!token.trim()) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code: "invalid_token" },
        { status: 400 }
      );
    }
    if (
      body?.amountCents != null ||
      body?.amount != null ||
      body?.stripeAccount ||
      body?.paymentRequestId ||
      body?.proposalId
    ) {
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code: "amount_tamper" },
        { status: 400 }
      );
    }

    const acceptance = await recordProposalAcceptance(token.trim(), {
      customerOptionKey:
        typeof body?.optionKey === "string" ? body.optionKey : null,
    });
    if (!acceptance.ok) {
      const code = String(acceptance.code ?? "not_found");
      const status = TOKEN_FAILURE_CODES.has(code)
        ? 404
        : code === "idempotency_conflict"
          ? 409
          : 400;
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code },
        { status }
      );
    }

    const hash = hashProposalPublicAccessToken(token);
    let resolved = await resolvePublicJobPaymentCheckoutViaRpc(
      createAdminClient(),
      hash
    );
    const resolveCode = String(resolved.code ?? (resolved.ok === true ? "ok" : "not_found"));
    let requests: Awaited<ReturnType<typeof loadCheckoutRequestSnapshots>> = [];
    if (resolveCode === "not_payable") {
      requests = await loadCheckoutRequestSnapshots({
        companyId: acceptance.company_id,
        jobId: acceptance.job_id,
      });
    }
    const mayOpenDeposit =
      resolved.ok !== true &&
      publicCheckoutShouldOpenCanonicalDeposit({
        resolveCode,
        requests,
        proposalVersionId: acceptance.proposal_version_id,
        acceptanceId: acceptance.acceptance_id,
      });
    if (mayOpenDeposit) {
      const deposit = await openCanonicalDepositFromAcceptedProposal({
        companyId: acceptance.company_id,
        acceptanceId: acceptance.acceptance_id,
      });
      if (!deposit.ok) {
        return NextResponse.json(
          { ok: false, message: SAFE_ERROR, code: deposit.code },
          { status: deposit.code === "conflicting_request" ? 409 : 400 }
        );
      }
      resolved = await resolvePublicJobPaymentCheckoutViaRpc(
        createAdminClient(),
        hash
      );
    }
    if (resolved.ok !== true) {
      const code = String(resolved.code ?? "not_found");
      const status = code === "already_paid" ? 409 : code === "invalid_hash" ? 404 : 400;
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code },
        { status }
      );
    }

    const origin = appOriginFromRequest(req.headers.get("origin"));
    const returnPath = `${origin}/p/${encodeURIComponent(token.trim())}`;
    const opened = await openHostedCheckoutForRequest({
      request: {
        id: String(resolved.id),
        company_id: String(resolved.company_id),
        job_id: String(resolved.job_id),
        kind: resolved.kind as "deposit" | "progress" | "balance",
        status: String(resolved.status),
        amount_cents: Number(resolved.amount_cents),
        currency: String(resolved.currency),
        provider_account_id: String(resolved.provider_account_id),
        provider_checkout_session_id: resolved.provider_checkout_session_id
          ? String(resolved.provider_checkout_session_id)
          : null,
        checkout_generation: Number(resolved.checkout_generation ?? 0),
      },
      successUrl: withPaymentReturnHint(returnPath, "pending"),
      cancelUrl: withPaymentReturnHint(returnPath, "cancelled"),
    });

    return NextResponse.json({ ok: true, url: opened.url });
  } catch (error) {
    if (isPublicAppOriginError(error)) {
      console.error("[public/payment-requests/checkout]", PUBLIC_ORIGIN_MISCONFIGURED_CODE);
      return NextResponse.json(
        { ok: false, message: SAFE_ERROR, code: PUBLIC_ORIGIN_MISCONFIGURED_CODE },
        { status: 503 }
      );
    }
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "internal_error";
    return NextResponse.json(
      { ok: false, message: SAFE_ERROR, code },
      { status: code === "already_paid" ? 409 : 500 }
    );
  }
}
