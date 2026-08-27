import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  PROPOSAL_PACKET_CHOICE_BUTTON,
  PROPOSAL_PACKET_CHOICE_BUTTON_CHOSEN,
  PROPOSAL_PACKET_CTA_CONTINUATION,
  PROPOSAL_PACKET_CTA_FOCUS,
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";

const ROOT = process.cwd();
const PACKET_DIR = "app/components/proposal-packet";

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

describe("proposal packet customer CTA targets — premium purchase flow", () => {
  test("every customer action enforces 44px min height and a visible focus ring", () => {
    for (const cls of [
      PROPOSAL_PACKET_CTA_PRIMARY,
      PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT,
      PROPOSAL_PACKET_CTA_SECONDARY,
      PROPOSAL_PACKET_CTA_CONTINUATION,
      PROPOSAL_PACKET_CHOICE_BUTTON,
      PROPOSAL_PACKET_CHOICE_BUTTON_CHOSEN,
    ]) {
      const minHeight = /min-h-\[(\d+)px\]/.exec(cls);
      assert.ok(minHeight, `missing min-h on: ${cls}`);
      assert.ok(
        Number(minHeight[1]) >= 44,
        `tap target ${minHeight[1]}px is below 44px`
      );
      assert.match(cls, /focus-visible:ring-2/);
    }
    assert.match(PROPOSAL_PACKET_CTA_FOCUS, /focus-visible:ring-2/);
  });

  test("the dominant primary is full width so it cannot be mistaken for a peer", () => {
    assert.match(PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT, /w-full/);
  });

  test("exactly one purchase composition owns the customer primary action", () => {
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.equal((packet.match(/<ProposalPacketPurchase/g) ?? []).length, 1);
    // The sticky bar is a responsive presentation of the same action object.
    assert.match(packet, /<ProposalPacketStickyPurchaseBar/);
    assert.equal((packet.match(/useProposalPurchaseAction\(/g) ?? []).length, 1);
  });

  test("no competing primary lives in the hero, closeout, or details", () => {
    for (const file of [
      "ProposalPacketHero.tsx",
      "ProposalPacketContact.tsx",
      "ProposalPacketDetailsContact.tsx",
    ]) {
      const source = read(`${PACKET_DIR}/${file}`);
      assert.doesNotMatch(source, /PROPOSAL_PACKET_CTA_PRIMARY/);
      assert.doesNotMatch(source, /data-public-pay/);
      assert.doesNotMatch(source, /onConfirmed/);
    }
  });

  test("Ask a question is a quiet text link, never a full-width button", () => {
    const closeout = read(`${PACKET_DIR}/ProposalPacketContact.tsx`);
    assert.match(closeout, /PROPOSAL_PACKET_CTA_TEXT_LINK/);
    assert.match(closeout, /data-proposal-cta="ask-question"/);
    assert.doesNotMatch(closeout, /PROPOSAL_PACKET_CTA_SECONDARY/);
  });

  test("superseded customer-flow components are gone from the packet", () => {
    for (const file of [
      "ProposalPacketCustomerActions.tsx",
      "ProposalPacketTrustBand.tsx",
    ]) {
      assert.equal(
        existsSync(join(ROOT, PACKET_DIR, file)),
        false,
        `${file} should be deleted`
      );
    }
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.doesNotMatch(packet, /ProposalPacketPackageInterestActions/);
    assert.doesNotMatch(packet, /ProposalPacketPayment/);
    assert.doesNotMatch(packet, /ProposalPaymentTermsBlock/);
    assert.doesNotMatch(packet, /signProminence/);
  });

  test("comparison is interactive customer language, not app state", () => {
    const comparison = read(`${PACKET_DIR}/ProposalPacketComparison.tsx`);
    assert.doesNotMatch(comparison, /Selected for this proposal/);
    assert.doesNotMatch(comparison, /Offered for comparison/);
    assert.doesNotMatch(comparison, /aria-readonly/);
    assert.doesNotMatch(comparison, /buildPackageInterestHref/);
    assert.match(comparison, /aria-pressed/);
    assert.match(comparison, /data-proposal-choose-option/);
  });

  test("checkout creates acceptance before resolving payment request", () => {
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(checkout, /recordProposalAcceptance/);
    assert.match(checkout, /openCanonicalDepositFromAcceptedProposal/);
    assert.match(checkout, /resolvePublicJobPaymentCheckoutViaRpc/);
    const postBody = checkout.slice(checkout.indexOf("export async function POST"));
    const acceptIdx = postBody.indexOf("recordProposalAcceptance");
    const depositIdx = postBody.indexOf("openCanonicalDepositFromAcceptedProposal");
    const resolveIdx = postBody.indexOf("resolvePublicJobPaymentCheckoutViaRpc");
    assert.ok(acceptIdx >= 0 && depositIdx > acceptIdx && resolveIdx > depositIdx);
  });
});
