/**
 * Phase 2C — send/delivery partial-success envelope + contract guards.
 *
 * Run: npx tsx --test app/lib/proposalSendDeliveryEnvelope.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  PROPOSAL_SENT_DELIVERY_COPY,
  PROPOSAL_SENT_TITLE,
  mapCheckingDelivery,
  mapFailedDelivery,
  mapSubmittedDelivery,
  proposalSendStatusFromSnapshot,
} from "@/app/lib/proposalSendDeliveryEnvelope";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(`${ROOT}/${rel}`, "utf8");
}

describe("Phase 2C — envelope helpers", () => {
  test("proposal send status: created/refrozen → sent; reused/replay → replayed", () => {
    assert.equal(proposalSendStatusFromSnapshot("created"), "sent");
    assert.equal(proposalSendStatusFromSnapshot("refrozen"), "sent");
    assert.equal(proposalSendStatusFromSnapshot("reused"), "replayed");
    assert.equal(
      proposalSendStatusFromSnapshot("created", { idempotentDeliveryReplay: true }),
      "replayed"
    );
  });

  test("delivery mapping never claims webhook delivered", () => {
    assert.equal(mapSubmittedDelivery({ attemptId: "a1" }).status, "submitted");
    assert.equal(mapFailedDelivery({ code: "x", message: "m" }).status, "failed");
    assert.equal(
      mapCheckingDelivery({ attemptId: "a1", code: "pending", message: "check" }).status,
      "checking"
    );
    assert.equal(PROPOSAL_SENT_TITLE, "Sent version preserved.");
    assert.match(PROPOSAL_SENT_DELIVERY_COPY.failed, /Email delivery needs attention/i);
  });
});

describe("Phase 2C — route and client contract", () => {
  test("layered envelope wired through orchestrator, route, and send gate", () => {
    const envelope = read("app/lib/proposalSendDeliveryEnvelope.ts");
    const route = read("app/api/proposals/send/route.ts");
    const orchestrator = read("app/lib/proposalEmailDelivery.ts");
    const panel = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx"
    );

    assert.match(envelope, /PROPOSAL_SENT_TITLE/);
    assert.match(orchestrator, /partialSuccessAfterSnapshot/);
    assert.match(orchestrator, /mapFailedDelivery/);
    assert.match(orchestrator, /mapCheckingDelivery/);
    assert.match(route, /sendProposalEmailForContractor/);
    assert.match(panel, /data-preview-send-partial/);
    assert.match(panel, /SEND_GATE_RETRY_EMAIL_LABEL/);
    assert.match(panel, /SEND_GATE_PROPOSAL_SENT_TITLE/);
  });

  test("post-freeze Resend failure returns partial success, not monolithic failure", () => {
    const orchestrator = read("app/lib/proposalEmailDelivery.ts");
    assert.match(orchestrator, /Snapshot already durable/);
    assert.doesNotMatch(
      orchestrator,
      /return failure\(resendResult\.message, resendResult\.code/
    );
  });

  test("Phase 2B2 acceptance envelope remains intact", () => {
    const accept = read("app/api/proposals/accept/route.ts");
    assert.match(accept, /mapDepositContinuation/);
    assert.match(accept, /ok: true/);
    assert.match(accept, /ACCEPTANCE_RECORDED_TITLE/);
  });

  test("Resend webhook path remains separate delivery truth authority", () => {
    const webhook = read("app/api/webhooks/resend/route.ts");
    assert.match(webhook, /svix/i);
  });

  test("retry label is delivery-specific", () => {
    const readiness = read("app/lib/proposalSendGateReadiness.ts");
    assert.match(readiness, /SEND_GATE_RETRY_EMAIL_LABEL = "Retry email"/);
    assert.match(
      readiness,
      /SEND_GATE_PROPOSAL_SENT_TITLE = "Sent version preserved\."/
    );
    assert.doesNotMatch(readiness, /Proposal is ready/);
  });

  test("post-freeze in-progress is partial success, not ok:false", () => {
    const orchestrator = read("app/lib/proposalEmailDelivery.ts");
    assert.match(orchestrator, /inFlightPartialSuccess/);
    assert.doesNotMatch(orchestrator, /function inFlightFailure/);
  });

  test("frozen history writers are not called from delivery failure path", () => {
    const orchestrator = read("app/lib/proposalEmailDelivery.ts");
    // Delivery mark-failed must not freeze or rewrite versions
    assert.match(orchestrator, /markDeliveryAttemptFailed/);
    assert.doesNotMatch(
      orchestrator.slice(orchestrator.indexOf("if (!resendResult.ok)")),
      /freezeDraft/
    );
  });
});
