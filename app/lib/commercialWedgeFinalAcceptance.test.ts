/**
 * Commercial Wedge final acceptance — send enablement + primary-flow hierarchy.
 * Run: npx tsx --test app/lib/commercialWedgeFinalAcceptance.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { ProposalSendFreezeReadiness } from "./proposalSendFreezeReadiness";
import {
  buildProposalSendGateReadinessViewModel,
  SEND_GATE_DELIVERY_DISABLED_MESSAGE,
} from "./proposalSendGateReadiness";
import {
  formatPrepareTemplateContextLabel,
  isPrepareTemplateContextSecondary,
  PREPARE_PROPOSAL_FOOTER,
  PREPARE_PROPOSAL_SETUP_LABEL,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function readySendFreeze(
  overrides: Partial<ProposalSendFreezeReadiness> = {}
): ProposalSendFreezeReadiness {
  return {
    ready: true,
    blockingReasons: [],
    warnings: ["Company logo is missing from context_echo; cover may use fallback branding."],
    summary: {
      scopeSummary: { hiddenLineCount: 0, excludedLineCount: 0, hiddenPageCount: 0 },
      selectedTemplateOptionId: "opt-a",
      pricingComplete: true,
      blockingLineCount: 0,
      estimatePagePresent: true,
      customerVisiblePageCount: 2,
      hasLatestSentVersion: false,
      displaySettingsResolvable: true,
    },
    ...overrides,
  };
}

describe("final Send proposal enablement", () => {
  test("fully truthful first proposal enables final Send without prior snapshot", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: {
        blockingLineCount: 0,
        pricingComplete: true,
        warnings: [],
      },
      recipientEmail: "g3v3@example.com",
      customerFirstName: "G3v3",
      companyName: "Anderson Roofing",
      projectAddress: "1842 Oak Ridge Dr",
      emailDeliveryConfigured: true,
    });
    assert.equal(vm.canSend, true);
    assert.equal(vm.deliveryEnabled, true);
    assert.equal(vm.disabledReason, "");
  });

  test("true blockers still disable Send", () => {
    const missingEmail = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: { blockingLineCount: 0, pricingComplete: true, warnings: [] },
      recipientEmail: null,
      customerFirstName: null,
      companyName: "Anderson Roofing",
      projectAddress: null,
      emailDeliveryConfigured: true,
    });
    assert.equal(missingEmail.canSend, false);

    const quantities = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: { blockingLineCount: 3, pricingComplete: true, warnings: [] },
      recipientEmail: "g3v3@example.com",
      customerFirstName: "G3v3",
      companyName: "Anderson Roofing",
      projectAddress: null,
      emailDeliveryConfigured: true,
    });
    assert.equal(quantities.canSend, false);

    const noDelivery = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: { blockingLineCount: 0, pricingComplete: true, warnings: [] },
      recipientEmail: "g3v3@example.com",
      customerFirstName: "G3v3",
      companyName: "Anderson Roofing",
      projectAddress: null,
      emailDeliveryConfigured: false,
    });
    assert.equal(noDelivery.canSend, false);
    assert.equal(noDelivery.disabledReason, SEND_GATE_DELIVERY_DISABLED_MESSAGE);
  });

  test("missing logo warning does not disable Send", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: { blockingLineCount: 0, pricingComplete: true, warnings: [] },
      recipientEmail: "g3v3@example.com",
      customerFirstName: "G3v3",
      companyName: "Anderson Roofing",
      projectAddress: null,
      emailDeliveryConfigured: true,
    });
    assert.equal(vm.canSend, true);
    assert.ok(vm.checklist.every((item) => item.id !== "branding_identity" || item.status === "ready"));
  });

  test("Send panel exposes enabled attribute for the final action", () => {
    const panel = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx"
    );
    assert.match(panel, /data-preview-send-proposal/);
    assert.match(panel, /data-preview-send-enabled=\{canSendProposalEmail \? "true" : "false"\}/);
    assert.match(panel, /data-preview-send-visual=\{canSendProposalEmail \? "enabled" : "disabled"\}/);
    assert.match(panel, /disabled=\{!canSendProposalEmail\}/);
    assert.match(panel, /SEND_PRIMARY_ENABLED/);
    assert.match(panel, /SEND_PRIMARY_DISABLED/);
  });
});

describe("no-logo fallback is intentional", () => {
  test("Preview cover uses initials wordmark without a gray logo box", () => {
    const cover = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewPacketCover.tsx"
    );
    assert.match(cover, /data-preview-brand-fallback="initials"/);
    assert.match(cover, /data-preview-brand-wordmark/);
    assert.doesNotMatch(cover, /bg-slate-100|bg-gray-|placeholder logo/i);
    assert.doesNotMatch(
      cover,
      /flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-\[11px\] font-bold text-white/
    );
  });
});

describe("Prepare secondary template controls", () => {
  test("prepared template + package collapse to subordinate Template row", () => {
    assert.equal(PREPARE_PROPOSAL_SETUP_LABEL, "Template");
    assert.equal(PREPARE_PROPOSAL_FOOTER, "");
    assert.equal(
      isPrepareTemplateContextSecondary({
        setup: "prepared",
        package: "prepared",
      }),
      true
    );
    assert.equal(
      formatPrepareTemplateContextLabel({
        setupLabel: "Test",
        packageLabel: "Standard",
      }),
      "Test · Standard package"
    );
    const modal = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
    assert.match(modal, /data-jobcard-prepare-template-secondary/);
    assert.match(modal, /SECONDARY_CHANGE_BUTTON_CLASS/);
    assert.doesNotMatch(modal, /Your reusable setup stays unchanged/);
  });
});

describe("New Job ZIP defaults leakage", () => {
  test("packet New Job does not announce missing ZIP defaults", () => {
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    const start = roofing.indexOf("function renderJobPacketWorkbench");
    const end = roofing.indexOf("function renderLegacyEstimateWorkspace");
    assert.ok(start >= 0 && end > start);
    const workbench = roofing.slice(start, end);
    assert.doesNotMatch(workbench, /No ZIP defaults saved/);
    assert.match(workbench, /Auto-filled from ZIP defaults/);
    assert.match(workbench, /Clear ZIP defaults/);
  });
});

describe("Job Card mobile tab rail remains scrollable", () => {
  test("tabs use horizontal overflow without page redesign", () => {
    const tabs = read("app/tools/roofing/jobCard/JobCardTabs.tsx");
    assert.match(tabs, /overflow-x-auto/);
    assert.match(tabs, /touch-pan-x/);
    assert.match(tabs, /data-jobcard-tab=/);
    assert.match(tabs, /shrink-0/);
  });
});

describe("authority unchanged", () => {
  test("no proposal template seed or quantity resolver formula edits in this correction", () => {
    // Presence contract — final acceptance must not invent tear-off/disposal math.
    const ownership = read("app/lib/firstProposalQuantityOwnership.ts");
    assert.match(ownership, /tear_off_required/);
    assert.match(ownership, /debris_tons_estimate/);
    assert.doesNotMatch(ownership, /tonsPerSquare|invent.*disposal/i);
    const handoff = read("app/lib/measurementProposalHandoff.ts");
    assert.match(handoff, /if \(record\.tear_off_required && q\.roof_squares/);
  });
});
