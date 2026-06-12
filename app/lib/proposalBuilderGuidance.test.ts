import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveProposalBuilderGuidance,
  type ProposalBuilderGuidanceInput,
} from "./proposalBuilderGuidance";

function baseInput(
  overrides: Partial<ProposalBuilderGuidanceInput> = {}
): ProposalBuilderGuidanceInput {
  return {
    hasPersistedProposal: true,
    selectedOptionId: "option-standard",
    templateReady: true,
    measurementReady: true,
    measurementStale: false,
    pricingComplete: true,
    blockingLineCount: 0,
    guardrailStatus: "pass",
    hasProposalPages: true,
    hasPlaceholderPages: false,
    previewEnabled: false,
    sendEnabled: false,
    signEnabled: false,
    paymentEnabled: false,
    productionEnabled: false,
    ...overrides,
  };
}

function stepById(
  guidance: ReturnType<typeof deriveProposalBuilderGuidance>,
  id: string
) {
  const step = guidance.steps.find((item) => item.id === id);
  assert.ok(step, `expected step ${id}`);
  return step;
}

function lifecycleById(
  guidance: ReturnType<typeof deriveProposalBuilderGuidance>,
  actionId: string
) {
  const lock = guidance.lifecycleLocks.find((item) => item.actionId === actionId);
  assert.ok(lock, `expected lifecycle lock ${actionId}`);
  return lock;
}

describe("deriveProposalBuilderGuidance", () => {
  test("happy path: setup ready but lifecycle actions disabled", () => {
    const guidance = deriveProposalBuilderGuidance(baseInput());

    assert.equal(guidance.nextAction.id, "ready_for_preview");
    assert.equal(guidance.nextAction.title, "Ready for Preview");
    assert.equal(guidance.nextAction.disabled, true);
    assert.equal(guidance.nextAction.target, "action:preview");
    assert.equal(guidance.isReadyForPreviewWhenEnabled, true);

    const preview = stepById(guidance, "preview");
    assert.equal(preview.state, "locked");
    assert.match(preview.lockedReason ?? "", /roadmap phase/i);

    const production = stepById(guidance, "production");
    assert.equal(production.state, "future");

    const previewLock = lifecycleById(guidance, "preview");
    assert.equal(previewLock.state, "locked");
    assert.match(previewLock.lockedReason ?? "", /roadmap phase/i);
  });

  test("stale measurement prioritizes refresh next action", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ measurementStale: true })
    );

    assert.equal(stepById(guidance, "measurement").state, "attention");
    assert.equal(stepById(guidance, "quantities").state, "attention");

    assert.equal(guidance.nextAction.id, "measurement_stale");
    assert.equal(guidance.nextAction.title, "Measurement changed");
    assert.equal(guidance.nextAction.ctaLabel, "Refresh draft pricing");
    assert.equal(guidance.nextAction.target, "action:refresh-pricing");
    assert.equal(guidance.isReadyForPreviewWhenEnabled, false);
  });

  test("missing selected package surfaces choose-package next action", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ selectedOptionId: null })
    );

    assert.equal(stepById(guidance, "package").state, "attention");
    assert.equal(guidance.nextAction.id, "choose_package");
    assert.equal(guidance.nextAction.title, "Choose a package");
    assert.equal(guidance.nextAction.target, "page:estimate");
    assert.equal(guidance.isReadyForPreviewWhenEnabled, false);
  });

  test("pricing blockers block pricing step and preview lock reason", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ pricingComplete: false, blockingLineCount: 2 })
    );

    assert.equal(stepById(guidance, "pricing").state, "blocked");
    assert.equal(guidance.nextAction.id, "resolve_pricing_blockers");
    assert.equal(guidance.nextAction.title, "Resolve pricing blockers");
    assert.equal(guidance.nextAction.target, "workspace:line-items");
    assert.match(guidance.nextAction.description, /2 line items/);

    const previewLock = lifecycleById(guidance, "preview");
    assert.match(previewLock.lockedReason ?? "", /2 line items/);
    assert.equal(guidance.isReadyForPreviewWhenEnabled, false);
  });

  test("guardrail attention surfaces profitability review", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ guardrailStatus: "attention" })
    );

    assert.equal(stepById(guidance, "pricing").state, "attention");
    assert.equal(guidance.nextAction.id, "review_profitability");
    assert.equal(guidance.nextAction.title, "Review profitability");
    assert.equal(guidance.nextAction.target, "workspace:line-items");
    assert.equal(guidance.isReadyForPreviewWhenEnabled, false);
  });

  test("placeholder pages surface review-pages next action when no higher-priority issue", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ hasPlaceholderPages: true })
    );

    assert.equal(stepById(guidance, "pages").state, "attention");
    assert.equal(guidance.nextAction.id, "review_proposal_pages");
    assert.equal(guidance.nextAction.title, "Review proposal pages");
    assert.equal(guidance.nextAction.target, "page:terms");
    assert.equal(guidance.isReadyForPreviewWhenEnabled, false);
  });

  test("missing measurement blocks measurement and quantities without fake lifecycle enablement", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ measurementReady: false })
    );

    assert.equal(stepById(guidance, "measurement").state, "blocked");
    assert.equal(stepById(guidance, "quantities").state, "blocked");
    assert.equal(guidance.nextAction.id, "review_proposal");
    assert.equal(lifecycleById(guidance, "preview").state, "locked");
    assert.equal(lifecycleById(guidance, "send").state, "locked");
    assert.equal(lifecycleById(guidance, "sign").state, "locked");
    assert.equal(lifecycleById(guidance, "payment").state, "locked");
  });

  test("missing template blocks template step", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ templateReady: false })
    );

    assert.equal(stepById(guidance, "template").state, "blocked");
    assert.equal(guidance.isReadyForPreviewWhenEnabled, false);
  });

  test("lifecycle locks follow Preview → Send → Sign → Payment → Production order", () => {
    const guidance = deriveProposalBuilderGuidance(baseInput());

    const preview = lifecycleById(guidance, "preview");
    const send = lifecycleById(guidance, "send");
    const sign = lifecycleById(guidance, "sign");
    const payment = lifecycleById(guidance, "payment");
    const production = lifecycleById(guidance, "production");

    assert.equal(preview.state, "locked");
    assert.match(preview.unlockSummary, /roadmap phase/i);

    assert.equal(send.state, "locked");
    assert.equal(send.lockedReason, "Available after Preview.");
    assert.match(send.unlockSummary, /after Preview/i);

    assert.equal(sign.state, "locked");
    assert.equal(sign.lockedReason, "Available after Send.");
    assert.match(sign.unlockSummary, /after Send/i);

    assert.equal(payment.state, "locked");
    assert.equal(payment.lockedReason, "Available after Sign / Approval.");
    assert.match(payment.unlockSummary, /after Sign \/ Approval/i);

    assert.equal(production.state, "future");
    assert.match(production.lockedReason ?? "", /Job Card after approval\/payment/i);
  });

  test("returns all eleven guided steps with labels", () => {
    const guidance = deriveProposalBuilderGuidance(baseInput());

    assert.equal(guidance.steps.length, 11);
    assert.deepEqual(
      guidance.steps.map((step) => step.label),
      [
        "Measurement",
        "Template",
        "Package",
        "Quantities",
        "Line Items / Pricing",
        "Pages",
        "Preview",
        "Send",
        "Sign / Approval",
        "Payment",
        "Production",
      ]
    );
  });

  test("selected package step uses selected state", () => {
    const guidance = deriveProposalBuilderGuidance(baseInput());

    assert.equal(stepById(guidance, "package").state, "selected");
    assert.equal(stepById(guidance, "package").shortStatusLabel, "Selected");
  });

  test("pages with no proposal pages are future", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ hasProposalPages: false, hasPlaceholderPages: false })
    );

    assert.equal(stepById(guidance, "pages").state, "future");
  });

  test("stale refresh action disabled when proposal is not persisted", () => {
    const guidance = deriveProposalBuilderGuidance(
      baseInput({ hasPersistedProposal: false, measurementStale: true })
    );

    assert.equal(guidance.nextAction.id, "measurement_stale");
    assert.equal(guidance.nextAction.disabled, true);
    assert.match(guidance.nextAction.disabledReason ?? "", /Save a proposal draft/i);
  });
});
