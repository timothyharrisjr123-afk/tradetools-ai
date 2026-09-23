/**
 * Phase 2B2 / FD-P1-05 — acceptance vs deposit continuation separation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  ACCEPTANCE_RECORDED_TITLE,
  DEPOSIT_CONTINUATION_COPY,
  depositContinuationNeedsCustomerAttention,
  mapCheckoutContinuationError,
  mapDepositContinuation,
} from "./proposalAcceptanceDepositEnvelope";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Phase 2B2 — deposit continuation mapping", () => {
  test("1. no deposit required", () => {
    const mapped = mapDepositContinuation({
      ok: true,
      skipped: true,
      code: "no_deposit",
    });
    assert.equal(mapped.status, "not_required");
    assert.equal(mapped.message, null);
  });

  test("2. deposit already satisfied", () => {
    const mapped = mapDepositContinuation({
      ok: true,
      skipped: true,
      code: "deposit_satisfied",
      id: "req-1",
    });
    assert.equal(mapped.status, "satisfied");
    assert.equal(mapped.paymentRequestId, "req-1");
  });

  test("3. deposit request opened", () => {
    const mapped = mapDepositContinuation({
      ok: true,
      skipped: false,
      id: "req-new",
      amount_cents: 50000,
    });
    assert.equal(mapped.status, "ready");
    assert.equal(mapped.paymentRequestId, "req-new");
    assert.equal(mapped.message, DEPOSIT_CONTINUATION_COPY.ready);
  });

  test("4. same deposit request replayed", () => {
    const mapped = mapDepositContinuation({
      ok: true,
      skipped: false,
      id: "req-same",
      idempotent_replay: true,
    });
    assert.equal(mapped.status, "ready");
    assert.equal(mapped.code, "idempotent_replay");
  });

  test("5. not_connected → setup_required", () => {
    const mapped = mapDepositContinuation({
      ok: false,
      code: "not_connected",
    });
    assert.equal(mapped.status, "setup_required");
    assert.equal(mapped.message, DEPOSIT_CONTINUATION_COPY.setup_required);
    assert.equal(depositContinuationNeedsCustomerAttention(mapped.status), true);
  });

  test("6. onboarding/setup collapses to not_connected at RPC (setup_required UX)", () => {
    // Canonical deposit RPC uses not_connected when charges_enabled is false.
    const mapped = mapDepositContinuation({ ok: false, code: "not_connected" });
    assert.equal(mapped.status, "setup_required");
  });

  test("7. deposit open failed → continuation_failed", () => {
    const mapped = mapDepositContinuation({
      ok: false,
      code: "deposit_open_failed",
    });
    assert.equal(mapped.status, "continuation_failed");
    assert.match(mapped.message ?? "", /could not finish the payment step/);
  });

  test("8. conflicting active request", () => {
    const mapped = mapDepositContinuation({
      ok: false,
      code: "conflicting_request",
    });
    assert.equal(mapped.status, "conflict");
  });
});

describe("Phase 2B2 — checkout continuation mapping", () => {
  test("17. reconciliation unavailable", () => {
    const mapped = mapCheckoutContinuationError("checkout_reconciliation_unavailable");
    assert.equal(mapped.status, "reconciliation_unavailable");
  });

  test("18. already paid", () => {
    assert.equal(mapCheckoutContinuationError("already_paid").status, "already_paid");
  });

  test("19. processing", () => {
    assert.equal(mapCheckoutContinuationError("processing").status, "processing");
  });
});

describe("Phase 2B2 — route partial-success contract", () => {
  test("accept never refuses on deposit failure after durable acceptance", () => {
    const accept = read("app/api/proposals/accept/route.ts");
    assert.match(accept, /mapDepositContinuation/);
    assert.match(accept, /acceptance:/);
    assert.match(accept, /deposit,/);
    assert.doesNotMatch(accept, /if \(!deposit\.ok\)/);
    assert.doesNotMatch(
      accept,
      /ok:\s*false[\s\S]{0,80}could not accept[\s\S]{0,40}deposit/
    );
    assert.match(accept, /ok: true/);
    assert.match(accept, /ACCEPTANCE_RECORDED_TITLE/);
  });

  test("sign never claims signature failed when deposit continuation fails", () => {
    const sign = read("app/api/proposals/sign/route.ts");
    assert.match(sign, /mapDepositContinuation/);
    assert.doesNotMatch(sign, /if \(!deposit\.ok\)/);
    assert.match(sign, /acceptance,/);
    assert.match(sign, /deposit,/);
  });

  test("checkout returns acceptance + deposit/checkout layers; preserves 2B1 recovery", () => {
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(checkout, /mapDepositContinuation/);
    assert.match(checkout, /mapCheckoutContinuationError/);
    assert.match(checkout, /partialSuccessResponse/);
    assert.match(checkout, /openHostedCheckoutForRequest/);
    // Deposit failure after acceptance → partial success, not SAFE_ERROR acceptance fail
    assert.match(checkout, /if \(!depositRaw\.ok\)/);
    assert.match(checkout, /return partialSuccessResponse/);
    assert.doesNotMatch(
      checkout,
      /if \(!deposit\.ok\) \{\s*return NextResponse\.json\(\s*\{\s*ok: false/
    );
  });

  test("9–12. retry / lost response: accept returns replay envelope; no duplicate refuse", () => {
    const accept = read("app/api/proposals/accept/route.ts");
    assert.match(accept, /idempotent_replay \? "replayed" : "accepted"/);
    assert.match(accept, /idempotentReplay: result\.idempotent_replay/);
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(checkout, /idempotent_replay \? "replayed" : "accepted"/);
  });

  test("13–14. sign success + deposit fail still returns ok true with acceptance", () => {
    const sign = read("app/api/proposals/sign/route.ts");
    assert.match(sign, /ok: true/);
    assert.match(sign, /mapDepositContinuation\(depositRaw\)/);
  });

  test("durable acceptance success path returns nested deposit, not SAFE_ERROR", () => {
    const accept = read("app/api/proposals/accept/route.ts");
    assert.match(accept, /title: ACCEPTANCE_RECORDED_TITLE/);
    assert.match(accept, /acceptance,\s*\n\s*deposit,/);
    assert.match(accept, /mapDepositContinuation\(depositRaw\)/);
    assert.doesNotMatch(accept, /if \(!deposit\.ok\)/);
  });
});

describe("Phase 2B2 — client state machine", () => {
  test("purchase action consumes acceptance/deposit envelopes", () => {
    const hook = read("app/components/proposal-packet/useProposalPurchaseAction.ts");
    assert.match(hook, /ProposalPurchaseOutcome/);
    assert.match(hook, /accepted_payment_setup_required/);
    assert.match(hook, /accepted_payment_continuation_failed/);
    assert.match(hook, /acceptanceKnown/);
    assert.match(hook, /onConfirmed\(\)/);
    assert.match(hook, /continuationNote/);
    assert.match(hook, /depositContinuationNeedsCustomerAttention/);
  });

  test("accept modal treats deposit note as secondary after success", () => {
    const modal = read("app/components/proposal-packet/ProposalPacketAcceptModal.tsx");
    assert.match(modal, /acceptanceDurable/);
    assert.match(modal, /data-proposal-accept-deposit-note/);
    assert.match(modal, /PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_TITLE/);
  });

  test("sign modal preserves success when deposit note present", () => {
    const modal = read("app/components/proposal-packet/ProposalPacketSignModal.tsx");
    assert.match(modal, /data-proposal-sign-deposit-note/);
    assert.match(modal, /payload\.acceptance/);
  });

  test("22–23. purchase surface keeps acceptance primary", () => {
    const purchase = read("app/components/proposal-packet/ProposalPacketPurchase.tsx");
    assert.match(purchase, /PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_TITLE/);
    assert.match(purchase, /data-proposal-purchase-continuation/);
  });

  test("CTA law: no Accept after accepted; payment uses pay kind", () => {
    const hook = read("app/components/proposal-packet/useProposalPurchaseAction.ts");
    assert.match(hook, /accepted\s*\n\s*\? "none"/);
    assert.match(hook, /payableNow\s*\n\s*\? "pay"/);
  });
});

describe("Phase 2B2 — layered response composition (lost-response / continuation)", () => {
  function composeAcceptResponse(input: {
    idempotentReplay: boolean;
    deposit: ReturnType<typeof mapDepositContinuation>;
  }) {
    return {
      ok: true as const,
      title: ACCEPTANCE_RECORDED_TITLE,
      acceptance: {
        status: input.idempotentReplay ? ("replayed" as const) : ("accepted" as const),
        acceptanceId: "acc-redacted",
        acceptedAt: "2026-09-20T12:00:00.000Z",
        proposalVersionId: "ver-redacted",
        idempotentReplay: input.idempotentReplay,
      },
      deposit: input.deposit,
    };
  }

  function clientWouldTreatAsAccepted(body: {
    ok?: boolean;
    acceptance?: { status?: string } | null;
  }): boolean {
    return (
      body.ok === true &&
      body.acceptance != null &&
      (body.acceptance.status === "accepted" || body.acceptance.status === "replayed")
    );
  }

  test("not_connected partial success never looks like acceptance failure to client", () => {
    const body = composeAcceptResponse({
      idempotentReplay: false,
      deposit: mapDepositContinuation({ ok: false, code: "not_connected" }),
    });
    assert.equal(body.deposit.status, "setup_required");
    assert.equal(body.deposit.code, "not_connected");
    assert.equal(clientWouldTreatAsAccepted(body), true);
    assert.equal(body.title, "Your acceptance is recorded.");
    assert.doesNotMatch(JSON.stringify(body), /could not accept/i);
  });

  test("accept response-loss replay returns replayed + reconciles deposit", () => {
    const first = composeAcceptResponse({
      idempotentReplay: false,
      deposit: mapDepositContinuation({
        ok: true,
        skipped: false,
        id: "req-same",
        amount_cents: 50000,
      }),
    });
    const retry = composeAcceptResponse({
      idempotentReplay: true,
      deposit: mapDepositContinuation({
        ok: true,
        skipped: false,
        id: "req-same",
        amount_cents: 50000,
        idempotent_replay: true,
      }),
    });
    assert.equal(first.acceptance.status, "accepted");
    assert.equal(retry.acceptance.status, "replayed");
    assert.equal(retry.deposit.paymentRequestId, first.deposit.paymentRequestId);
    assert.equal(retry.deposit.amountCents, first.deposit.amountCents);
    assert.equal(clientWouldTreatAsAccepted(retry), true);
  });

  test("deposit open fail then retry still accepted; continuation_failed", () => {
    const body = composeAcceptResponse({
      idempotentReplay: true,
      deposit: mapDepositContinuation({ ok: false, code: "deposit_open_failed" }),
    });
    assert.equal(body.acceptance.status, "replayed");
    assert.equal(body.deposit.status, "continuation_failed");
    assert.equal(clientWouldTreatAsAccepted(body), true);
    assert.match(body.deposit.message ?? "", /do not need to accept again/i);
  });

  test("conflict keeps acceptance success", () => {
    const body = composeAcceptResponse({
      idempotentReplay: false,
      deposit: mapDepositContinuation({ ok: false, code: "conflicting_request" }),
    });
    assert.equal(body.deposit.status, "conflict");
    assert.equal(clientWouldTreatAsAccepted(body), true);
  });

  test("checkout processing / already_paid / reconciliation layered results", () => {
    const processing = {
      ok: true as const,
      acceptance: { status: "replayed" as const },
      deposit: { status: "ready" as const, paymentRequestId: "req-1" },
      checkout: mapCheckoutContinuationError("processing"),
    };
    const paid = {
      ok: true as const,
      acceptance: { status: "replayed" as const },
      deposit: { status: "ready" as const, paymentRequestId: "req-1" },
      checkout: mapCheckoutContinuationError("already_paid"),
    };
    const checking = {
      ok: true as const,
      acceptance: { status: "accepted" as const },
      deposit: { status: "ready" as const, paymentRequestId: "req-1" },
      checkout: mapCheckoutContinuationError("checkout_reconciliation_unavailable"),
    };
    assert.equal(processing.checkout.status, "processing");
    assert.equal(paid.checkout.status, "already_paid");
    assert.equal(checking.checkout.status, "reconciliation_unavailable");
    assert.equal(clientWouldTreatAsAccepted(processing), true);
    assert.equal(clientWouldTreatAsAccepted(paid), true);
    assert.equal(clientWouldTreatAsAccepted(checking), true);
    assert.doesNotMatch(processing.checkout.message ?? "", /failed/i);
  });

  test("sign + setup_required composition stays durable", () => {
    const body = {
      ok: true as const,
      acceptance: {
        status: "accepted" as const,
        acceptanceId: "acc-redacted",
        acceptedAt: "2026-09-20T12:00:00.000Z",
        idempotentReplay: false,
      },
      deposit: mapDepositContinuation({ ok: false, code: "not_connected" }),
      signedAt: "2026-09-20T12:00:01.000Z",
    };
    assert.equal(clientWouldTreatAsAccepted(body), true);
    assert.equal(body.deposit.status, "setup_required");
    assert.ok(body.signedAt);
  });

  test("agreement projection source does not take payment failure as acceptance input", () => {
    const projection = read("app/lib/proposalAgreementProjection.ts");
    assert.match(projection, /Customer accepted proposal/);
    assert.doesNotMatch(projection, /deposit\.status|setup_required|continuation_failed/);
    assert.doesNotMatch(projection, /not_connected/);
  });
});

describe("Phase 2B2 — protect prior phases", () => {
  test("28. Phase 1 agreement title unchanged", () => {
    assert.equal(ACCEPTANCE_RECORDED_TITLE, "Your acceptance is recorded.");
  });

  test("25. Phase 2B1 recovery helper still imported by checkout server", () => {
    const server = read("app/lib/jobPaymentCheckout.server.ts");
    assert.match(server, /planCheckoutSessionRecovery/);
  });

  test("26–27. checkout still denies amount/account tamper", () => {
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(checkout, /amount_tamper/);
    assert.match(checkout, /stripeAccount/);
    assert.match(checkout, /paymentRequestId/);
  });

  test("S. payments_not_connected attention capability remains", () => {
    const attention = read("app/lib/jobAttentionPersistence.ts");
    assert.match(attention, /payments_not_connected/);
  });
});
