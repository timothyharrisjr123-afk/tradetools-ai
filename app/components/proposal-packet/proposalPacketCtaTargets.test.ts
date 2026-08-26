import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  PROPOSAL_PACKET_CTA_CONTINUATION,
  PROPOSAL_PACKET_CTA_FOCUS,
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_QUIET,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";

describe("proposal packet customer CTA targets — flow correction", () => {
  test("primary, secondary, continuation, and quiet CTAs enforce 44px min height", () => {
    for (const cls of [
      PROPOSAL_PACKET_CTA_PRIMARY,
      PROPOSAL_PACKET_CTA_SECONDARY,
      PROPOSAL_PACKET_CTA_CONTINUATION,
      PROPOSAL_PACKET_CTA_QUIET,
    ]) {
      assert.match(cls, /min-h-\[44px\]/);
      assert.match(cls, /focus-visible:ring-2/);
    }
    assert.match(PROPOSAL_PACKET_CTA_FOCUS, /focus-visible:ring-2/);
  });

  test("public packet uses one Pay surface and customer actions component", () => {
    const packet = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacket.tsx"),
      "utf8"
    );
    const payment = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketPayment.tsx"),
      "utf8"
    );
    const customerActions = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketCustomerActions.tsx"),
      "utf8"
    );
    const hero = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketHero.tsx"),
      "utf8"
    );

    assert.doesNotMatch(packet, /variant="banner"/);
    assert.equal((packet.match(/<ProposalPacketPayment/g) ?? []).length, 1);
    assert.doesNotMatch(packet, /signProminence/);
    assert.doesNotMatch(packet, /ProposalPacketPackageInterestActions/);
    assert.match(hero, /ProposalPacketCustomerActions/);
  });

  test("sent-offer path removes Request this package and Accept & sign", () => {
    const closeout = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketContact.tsx"),
      "utf8"
    );
    const comparison = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketComparison.tsx"),
      "utf8"
    );

    assert.doesNotMatch(closeout, /ProposalPacketPackageInterestActions/);
    assert.doesNotMatch(closeout, /request-package/);
    assert.doesNotMatch(comparison, /ask-about-package/);
    assert.doesNotMatch(comparison, /buildPackageInterestHref/);
    assert.match(comparison, /Selected for this proposal/);
  });

  test("checkout creates acceptance before resolving payment request", () => {
    const checkout = readFileSync(
      join(process.cwd(), "app/api/public/payment-requests/checkout/route.ts"),
      "utf8"
    );
    assert.match(checkout, /recordProposalAcceptance/);
    assert.match(checkout, /openJobDepositFromAcceptanceViaAdmin/);
    assert.match(checkout, /resolvePublicJobPaymentCheckoutViaRpc/);
    const postBody = checkout.slice(checkout.indexOf("export async function POST"));
    const acceptIdx = postBody.indexOf("recordProposalAcceptance");
    const depositIdx = postBody.indexOf("openJobDepositFromAcceptanceViaAdmin");
    const resolveIdx = postBody.indexOf("resolvePublicJobPaymentCheckoutViaRpc");
    assert.ok(acceptIdx >= 0 && depositIdx > acceptIdx && resolveIdx > depositIdx);
  });
});
