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

describe("proposal packet V2D1 customer CTA targets", () => {
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

  test("open payment request makes Pay the strongest action and demotes Sign", () => {
    const packet = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacket.tsx"),
      "utf8"
    );
    const payment = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketPayment.tsx"),
      "utf8"
    );
    const interest = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketPackageInterestActions.tsx"),
      "utf8"
    );

    assert.match(packet, /variant="banner"/);
    assert.match(packet, /signProminence=\{signProminence\}/);
    assert.match(packet, /paymentNeedsAction \? "continuation" : "primary"/);
    assert.match(payment, /data-public-payment-banner/);
    assert.match(payment, /data-public-pay/);
    assert.match(payment, /PROPOSAL_PACKET_CTA_PRIMARY/);
    assert.match(interest, /signProminence === "continuation"/);
    assert.match(interest, /data-proposal-cta="sign-proposal"/);
    assert.match(interest, /data-proposal-cta-prominence=\{signProminence\}/);
  });

  test("hero owns Accept & sign primary; request is continuation", () => {
    const hero = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketHero.tsx"),
      "utf8"
    );
    const closeout = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketContact.tsx"),
      "utf8"
    );
    const interest = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketPackageInterestActions.tsx"),
      "utf8"
    );

    assert.match(hero, /requestProminence="continuation"/);
    assert.match(closeout, /requestProminence="continuation"/);
    assert.match(interest, /data-proposal-cta="accept-and-sign"/);
    assert.match(interest, /PROPOSAL_CUSTOMER_PACKET_ACCEPT_AND_SIGN_CTA/);
    assert.match(interest, /PROPOSAL_PACKET_CTA_CONTINUATION/);
    assert.match(interest, /data-proposal-cta="request-package"/);
  });

  test("compare ask-about uses quiet CTA with full-width 44px target", () => {
    const comparison = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketComparison.tsx"),
      "utf8"
    );
    assert.match(comparison, /PROPOSAL_PACKET_CTA_QUIET/);
    assert.match(comparison, /data-proposal-cta="ask-about-package"/);
    assert.match(comparison, /min-h-\[44px\]/);
    assert.match(PROPOSAL_PACKET_CTA_QUIET, /\bw-full\b/);
  });
});
