/**
 * Premium Cohesion Cut 1 — Phase 1 customer purchase experience contract.
 *
 * Guards the product rules the visual gate cannot: one primary action, one
 * amount, customer language, single-offer behaviour, and the fact that the
 * client never carries price authority.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  PROPOSAL_CUSTOMER_PACKET_CHOSEN_BADGE,
  PROPOSAL_CUSTOMER_PACKET_DUE_TODAY_LABEL,
  PROPOSAL_CUSTOMER_PACKET_YOUR_PACKAGE_LABEL,
  proposalCustomerAmountLabel,
  proposalCustomerPacketChooseCta,
} from "./proposalCustomerPacketViewModel";
import {
  formatPaymentTermsCustomerCopy,
  resolveDepositObligationCents,
  termsRequireOnlineDeposit,
  type ProposalPaymentTerms,
} from "./proposalPaymentTerms";

const ROOT = process.cwd();
const PACKET_DIR = "app/components/proposal-packet";

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

const PERCENT_TERMS: ProposalPaymentTerms = {
  depositMode: "percent",
  depositPercentBps: 3000,
  depositFixedCents: null,
  depositDueTrigger: "on_acceptance",
  balanceDueTrigger: "on_completion",
};

const NO_DEPOSIT_TERMS: ProposalPaymentTerms = {
  depositMode: "none",
  depositPercentBps: null,
  depositFixedCents: null,
  depositDueTrigger: "on_acceptance",
  balanceDueTrigger: "on_completion",
};

describe("Phase 1 — single offer", () => {
  test("comparison renders nothing below two options, so a single offer has no picker", () => {
    const comparison = read(`${PACKET_DIR}/ProposalPacketComparison.tsx`);
    assert.match(comparison, /comparison\.options\.length < 2\) return null/);
  });

  test("packet only mounts the choice section when more than one option is offered", () => {
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.match(packet, /const showChoice = options\.length > 1/);
    assert.match(packet, /\{showChoice \? \(/);
  });

  test("a single offer still resolves the package from frozen contractor truth", () => {
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.match(packet, /chosenOption\?\.label \?\? packet\.estimate\?\.label/);
    assert.match(packet, /chosenOption\?\.totalCents \?\? packet\.selectedTotalCents/);
  });
});

describe("Phase 1 — multi-option selection", () => {
  test("selection is only sent when the customer actually had a choice", () => {
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.match(packet, /chosenOptionKey: showChoice \? chosenKey : null/);
  });

  test("choice defaults to the option the contractor put forward", () => {
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.match(packet, /options\.find\(\(option\) => option\.isCurrent\)\?\.optionKey/);
  });

  test("the picker locks once acceptance makes the choice contractual", () => {
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.match(packet, /locked=\{accepted\}/);
    const comparison = read(`${PACKET_DIR}/ProposalPacketComparison.tsx`);
    assert.match(comparison, /choosable = typeof onChoose === "function" && !locked/);
  });

  test("contractor preview stays a read-only document", () => {
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.match(packet, /onChoose=\{mode === "public" \? setChosenKey : undefined\}/);
  });

  test("choose wording is customer buying language", () => {
    assert.equal(proposalCustomerPacketChooseCta("Standard"), "Choose Standard");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_CHOSEN_BADGE, "Chosen");
  });

  test("forbidden app-state wording is absent from every customer packet component", () => {
    const banned = [
      "Request this package",
      "Selected for this proposal",
      "Offered for comparison",
      "Selected package",
      "Selected upgrades",
    ];
    for (const file of [
      "ProposalPacket.tsx",
      "ProposalPacketComparison.tsx",
      "ProposalPacketPurchase.tsx",
      "ProposalPacketStickyPurchaseBar.tsx",
      "ProposalPacketHero.tsx",
      "ProposalPacketContact.tsx",
      "ProposalPacketScope.tsx",
      "ProposalPacketUpgrades.tsx",
    ]) {
      const source = read(`${PACKET_DIR}/${file}`);
      for (const phrase of banned) {
        assert.ok(!source.includes(phrase), `${file} must not say "${phrase}"`);
      }
    }
  });
});

describe("Phase 1 — unified purchase composition", () => {
  test("package, price, terms, amount due, and action live in one component", () => {
    const purchase = read(`${PACKET_DIR}/ProposalPacketPurchase.tsx`);
    assert.match(purchase, /PROPOSAL_CUSTOMER_PACKET_YOUR_PACKAGE_LABEL/);
    assert.match(purchase, /packageTotalLabel/);
    assert.match(purchase, /formatPaymentTermsCustomerCopy/);
    assert.match(purchase, /PROPOSAL_CUSTOMER_PACKET_DUE_TODAY_LABEL/);
    assert.match(purchase, /PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT/);
  });

  test("the old split payment-terms and deposit-due surfaces are gone", () => {
    const packet = read(`${PACKET_DIR}/ProposalPacket.tsx`);
    assert.doesNotMatch(packet, /ProposalPaymentTermsBlock/);
    assert.doesNotMatch(packet, /ProposalPacketPayment\b/);
  });

  test("terms copy carries no amount, so the amount appears once in the due line", () => {
    const purchase = read(`${PACKET_DIR}/ProposalPacketPurchase.tsx`);
    assert.match(purchase, /formatPaymentTermsCustomerCopy\(terms, null\)/);
    const copy = formatPaymentTermsCustomerCopy(PERCENT_TERMS, null);
    assert.ok(!copy.depositLine.includes("$"), copy.depositLine);
    assert.equal((purchase.match(/data-proposal-due-today/g) ?? []).length, 1);
  });

  test("customer labels read as buying language", () => {
    assert.equal(PROPOSAL_CUSTOMER_PACKET_YOUR_PACKAGE_LABEL, "Your package");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_DUE_TODAY_LABEL, "Due today");
  });

  test("customer money drops trailing cents but keeps real ones", () => {
    assert.equal(proposalCustomerAmountLabel("$4,500.00"), "$4,500");
    assert.equal(proposalCustomerAmountLabel("$4,500.25"), "$4,500.25");
    assert.equal(proposalCustomerAmountLabel(""), null);
    assert.equal(proposalCustomerAmountLabel(null), null);
  });

  test("the due amount follows the chosen package before acceptance", () => {
    // 30% of each frozen option total — the composition derives, never guesses.
    assert.equal(
      resolveDepositObligationCents({
        mode: PERCENT_TERMS.depositMode,
        percentBps: PERCENT_TERMS.depositPercentBps,
        fixedCents: PERCENT_TERMS.depositFixedCents,
        acceptedTotalCents: 1500000,
      }),
      450000
    );
    assert.equal(
      resolveDepositObligationCents({
        mode: PERCENT_TERMS.depositMode,
        percentBps: PERCENT_TERMS.depositPercentBps,
        fixedCents: PERCENT_TERMS.depositFixedCents,
        acceptedTotalCents: 940000,
      }),
      282000
    );
  });

  test("once accepted the server-owned amount governs", () => {
    const purchase = read(`${PACKET_DIR}/ProposalPacketPurchase.tsx`);
    assert.match(purchase, /accepted \|\| state === "failed"\s*\?\s*payment\?\.amountLabel/);
  });
});

describe("Phase 1 — one canonical action", () => {
  test("deposit terms produce Pay, no-deposit terms produce Confirm", () => {
    assert.equal(termsRequireOnlineDeposit(PERCENT_TERMS), true);
    assert.equal(termsRequireOnlineDeposit(NO_DEPOSIT_TERMS), false);
    const hook = read(`${PACKET_DIR}/useProposalPurchaseAction.ts`);
    assert.match(hook, /requiresDeposit\s*\?\s*"pay"/);
    assert.match(hook, /PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA/);
  });

  test("the sticky bar reuses the same action object rather than a second handler", () => {
    const sticky = read(`${PACKET_DIR}/ProposalPacketStickyPurchaseBar.tsx`);
    assert.match(sticky, /action: ProposalPurchaseAction/);
    assert.match(sticky, /action\.submit/);
    assert.doesNotMatch(sticky, /fetch\(/);
    assert.doesNotMatch(sticky, /useProposalPurchaseAction\(/);
  });

  test("only an option key leaves the client — never an amount", () => {
    const hook = read(`${PACKET_DIR}/useProposalPurchaseAction.ts`);
    assert.match(hook, /body: \{ token: string; optionKey\?: string \}/);
    assert.doesNotMatch(hook, /amountCents|totalCents|amount:/);
  });

  test("no action is offered once payment has settled or is in flight", () => {
    const hook = read(`${PACKET_DIR}/useProposalPurchaseAction.ts`);
    assert.match(hook, /paymentState === "received" \|\| paymentState === "pending"/);
    assert.match(hook, /settled\s*\?\s*"none"/);
  });

  test("repeated presses cannot double-submit", () => {
    const hook = read(`${PACKET_DIR}/useProposalPurchaseAction.ts`);
    assert.match(hook, /if \(!publicAccessToken \|\| busy \|\| kind === "none"\) return/);
    const purchase = read(`${PACKET_DIR}/ProposalPacketPurchase.tsx`);
    assert.match(purchase, /disabled=\{action\.busy\}/);
  });

  test("payment method stays provider-owned in the CTA", () => {
    const hook = read(`${PACKET_DIR}/useProposalPurchaseAction.ts`);
    for (const banned of ["Pay by card", "Pay by debit", "Cash App", "ACH"]) {
      assert.ok(!hook.includes(banned), `CTA must not name ${banned}`);
    }
  });
});

describe("Phase 1 — payment states stay restrained", () => {
  test("received is emerald text with authoritative provider method only", () => {
    const purchase = read(`${PACKET_DIR}/ProposalPacketPurchase.tsx`);
    assert.match(purchase, /text-emerald-700/);
    assert.match(purchase, /data-public-payment-method/);
    assert.doesNotMatch(purchase, /bg-emerald-/);
  });

  test("pending is muted and offers no action", () => {
    const purchase = read(`${PACKET_DIR}/ProposalPacketPurchase.tsx`);
    assert.match(purchase, /PROPOSAL_PURCHASE_PROCESSING_TITLE/);
    assert.doesNotMatch(purchase, /bg-amber-|bg-yellow-/);
  });

  test("failed is restrained text with a retry, not a banner card", () => {
    const purchase = read(`${PACKET_DIR}/ProposalPacketPurchase.tsx`);
    assert.match(purchase, /PROPOSAL_PURCHASE_FAILED_TITLE/);
    assert.doesNotMatch(purchase, /bg-red-|bg-rose-/);
  });

  test("state sections are dividers, not nested cards", () => {
    const purchase = read(`${PACKET_DIR}/ProposalPacketPurchase.tsx`);
    assert.match(purchase, /PROPOSAL_PACKET_PURCHASE_DIVIDER/);
    assert.doesNotMatch(purchase, /rounded-\[1[0-9]px\] border/);
  });
});

describe("Phase 1 — dead customer UI removed", () => {
  test("superseded customer components no longer exist", () => {
    for (const file of [
      "ProposalPacketCustomerActions.tsx",
      "ProposalPacketTrustBand.tsx",
    ]) {
      assert.equal(existsSync(join(ROOT, PACKET_DIR, file)), false, file);
    }
  });

  test("hidden placeholder style tokens are gone", () => {
    const styles = read(`${PACKET_DIR}/proposalPacketStyles.ts`);
    for (const token of [
      "PROPOSAL_PACKET_HERO_MEDIA_COLUMN",
      "PROPOSAL_PACKET_HERO_MEDIA_CLIP",
      "PROPOSAL_PACKET_HERO_VISUAL",
      "PROPOSAL_PACKET_TRUST_BAND",
      "PROPOSAL_PACKET_OPTION_CARD_CURRENT",
      "PROPOSAL_PACKET_CURRENT_BADGE",
      "PROPOSAL_PACKET_DECISION_CARD",
    ]) {
      assert.ok(!styles.includes(token), `${token} should be deleted`);
    }
  });

  test("closeout no longer stacks filler cards for spacing", () => {
    const closeout = read(`${PACKET_DIR}/ProposalPacketContact.tsx`);
    assert.doesNotMatch(closeout, /PROPOSAL_PACKET_CLOSEOUT_TRUST/);
    assert.doesNotMatch(closeout, /NEXT_STEPS_ITEMS/);
    assert.doesNotMatch(closeout, /We stand behind our work/);
  });

  test("the superseded stage-1 flow-correction harness is retired", () => {
    assert.equal(
      existsSync(
        join(ROOT, "app/tools/roofing/jobCard/payment-stage-1-flow-correction/page.tsx")
      ),
      false
    );
  });
});
