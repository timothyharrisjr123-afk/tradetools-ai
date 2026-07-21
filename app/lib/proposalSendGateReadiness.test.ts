/**
 * R18D1 — proposalSendGateReadiness tests.
 *
 * Run: npx tsx --test app/lib/proposalSendGateReadiness.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { ProposalSendFreezeReadiness } from "./proposalSendFreezeReadiness";
import {
  buildProposalSendGateReadinessViewModel,
  canPrepareCustomerSendLink,
  SEND_GATE_EMAIL_LINK_NOTE,
  SEND_GATE_CUSTOMER_LINK_READY_LABEL,
  SEND_GATE_DEFERRED_ACTIONS,
  SEND_GATE_DELIVERY_DISABLED_MESSAGE,
  SEND_GATE_EMAIL_SEND_DISCLAIMER,
  SEND_GATE_LOADING_MESSAGE,
  SEND_GATE_MISSING_RECIPIENT_BODY,
  SEND_GATE_NO_SENT_SNAPSHOT_BODY,
  SEND_GATE_PANEL_INTRO,
  SEND_GATE_PANEL_TITLE,
  SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL,
} from "./proposalSendGateReadiness";

function readySendFreeze(overrides: Partial<ProposalSendFreezeReadiness> = {}): ProposalSendFreezeReadiness {
  return {
    ready: true,
    blockingReasons: [],
    warnings: [],
    summary: {
      scopeSummary: { hiddenLineCount: 0, excludedLineCount: 0, hiddenPageCount: 0 },
      selectedTemplateOptionId: "opt-a",
      pricingComplete: true,
      blockingLineCount: 0,
      estimatePagePresent: true,
      customerVisiblePageCount: 2,
      hasLatestSentVersion: true,
      displaySettingsResolvable: true,
    },
    ...overrides,
  };
}

function previewReadiness(overrides: {
  blockingLineCount?: number;
  pricingComplete?: boolean;
  warnings?: string[];
} = {}) {
  return {
    blockingLineCount: overrides.blockingLineCount ?? 0,
    pricingComplete: overrides.pricingComplete ?? true,
    warnings: overrides.warnings ?? [],
  };
}

const R18D1_SOURCE_FILES = [
  "./proposalSendGateReadiness.ts",
  "../tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx",
  "../tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx",
] as const;

describe("buildProposalSendGateReadinessViewModel", () => {
  test("loading phase shows checking message and disabled send", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      loading: true,
      hasSentSnapshot: false,
      sendFreezeReadiness: null,
      previewReadiness: null,
      recipientEmail: null,
      customerFirstName: null,
      companyName: null,
      projectAddress: null,
    });

    assert.equal(vm.phase, "loading");
    assert.equal(vm.summary, SEND_GATE_LOADING_MESSAGE);
    assert.equal(vm.deliveryEnabled, false);
    assert.equal(vm.canSend, false);
    assert.equal(vm.canPrepareCustomerLink, false);
    assert.equal(vm.checklist.every((item) => item.status === "loading"), true);
  });

  test("no sent snapshot marks customer view and sent snapshot as not ready", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: "123 Main St",
    });

    assert.equal(vm.phase, "no_sent_snapshot");
    assert.equal(vm.body, SEND_GATE_NO_SENT_SNAPSHOT_BODY);
    assert.equal(vm.canSend, false);
    assert.equal(vm.deliveryEnabled, false);

    const customerView = vm.checklist.find((item) => item.id === "customer_view");
    const sentSnapshot = vm.checklist.find((item) => item.id === "sent_snapshot");
    assert.equal(customerView?.status, "needs_sent_snapshot");
    assert.match(customerView?.detail ?? "", /needs sent snapshot/i);
    assert.equal(sentSnapshot?.status, "missing");
    assert.match(sentSnapshot?.detail ?? "", /not created yet/i);
    assert.equal(vm.canPrepareCustomerLink, true);
  });

  test("sent snapshot ready keeps send disabled when delivery is not configured", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: "123 Main St",
      emailDeliveryConfigured: false,
    });

    assert.equal(vm.phase, "ready");
    assert.equal(vm.canSend, false);
    assert.equal(vm.deliveryEnabled, false);
    assert.equal(vm.disabledReason, SEND_GATE_DELIVERY_DISABLED_MESSAGE);
    assert.equal(vm.canPrepareCustomerLink, true);
    assert.equal(vm.emailSendDisclaimer, SEND_GATE_EMAIL_SEND_DISCLAIMER);

    const customerView = vm.checklist.find((item) => item.id === "customer_view");
    const sentSnapshot = vm.checklist.find((item) => item.id === "sent_snapshot");
    assert.equal(customerView?.status, "ready");
    assert.equal(sentSnapshot?.status, "ready");
  });

  test("sent snapshot ready enables send when delivery is configured and readiness passes", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: "123 Main St",
      emailDeliveryConfigured: true,
    });

    assert.equal(vm.phase, "ready");
    assert.equal(vm.canSend, true);
    assert.equal(vm.deliveryEnabled, true);
    assert.equal(vm.emailSendDisclaimer, SEND_GATE_EMAIL_SEND_DISCLAIMER);
    assert.match(vm.emailSendDisclaimer, /Does not change proposal or job status yet/i);
  });

  test("canPrepareCustomerLink is false when readiness blocks", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze({ ready: false, blockingReasons: ["Blocked"] }),
      previewReadiness: previewReadiness({ pricingComplete: false, blockingLineCount: 2 }),
      recipientEmail: null,
      customerFirstName: null,
      companyName: null,
      projectAddress: null,
    });

    assert.equal(vm.canPrepareCustomerLink, false);
  });

  test("R18D2 copy constants are present", () => {
    assert.equal(SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL, "Prepare customer link");
    assert.equal(SEND_GATE_CUSTOMER_LINK_READY_LABEL, "Customer link ready");
  });

  test("missing recipient email surfaces missing checklist and body guidance", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: null,
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: null,
    });

    const recipient = vm.checklist.find((item) => item.id === "recipient_email");
    assert.equal(recipient?.status, "missing");
    assert.equal(vm.body, SEND_GATE_MISSING_RECIPIENT_BODY);
    assert.equal(vm.messagePreview.toMissing, true);
    assert.equal(vm.messagePreview.to, "");
    assert.equal(vm.canSend, false);
  });

  test("recipient email present populates message preview defaults", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Anderson Roofing",
      projectAddress: "456 Oak Ave",
    });

    assert.equal(vm.messagePreview.to, "jane@example.com");
    assert.equal(vm.messagePreview.toMissing, false);
    assert.match(vm.messagePreview.subject, /Anderson Roofing/);
    assert.match(vm.messagePreview.body, /Hi Jane,/);
    assert.match(vm.messagePreview.body, /prepared your roofing proposal for your project/);
    assert.match(vm.messagePreview.body, /Review the proposal details using the secure link below/);
    assert.doesNotMatch(vm.messagePreview.body, /456 Oak Ave/);
    assert.equal(vm.messagePreview.linkLabel, SEND_GATE_EMAIL_LINK_NOTE);
    assert.doesNotMatch(vm.messagePreview.body, /Available after send/i);
    assert.doesNotMatch(vm.messagePreview.body, /Review your proposal here/i);
    assert.doesNotMatch(vm.messagePreview.body, /https?:\/\//);
  });

  test("message preview uses graceful fallbacks when names are missing", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "customer@example.com",
      customerFirstName: null,
      companyName: null,
      projectAddress: null,
    });

    assert.match(vm.messagePreview.subject, /your contractor/i);
    assert.match(vm.messagePreview.body, /Hi there,/);
    assert.match(vm.messagePreview.body, /Your contractor/);
  });

  test("send-freeze blocking maps to pricing and branding checklist", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze({
        ready: false,
        blockingReasons: ["Company identity is missing.", "Pricing is incomplete."],
      }),
      previewReadiness: previewReadiness({ pricingComplete: false, blockingLineCount: 2 }),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: null,
      projectAddress: null,
    });

    const pricing = vm.checklist.find((item) => item.id === "pricing_scope");
    const branding = vm.checklist.find((item) => item.id === "branding_identity");
    assert.equal(pricing?.status, "needs_review");
    assert.equal(branding?.status, "needs_review");
    assert.equal(vm.canSend, false);
  });

  test("pricing stale warning maps to pricing needs review while send stays disabled", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze({
        warnings: ["Draft pricing may be stale."],
      }),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: null,
      pricingStale: true,
    });

    const pricing = vm.checklist.find((item) => item.id === "pricing_scope");
    assert.equal(pricing?.status, "needs_review");
    assert.match(pricing?.detail ?? "", /stale/i);
    assert.equal(vm.canSend, false);
  });

  test("deferred actions remain signature pdf payment only", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: null,
    });

    assert.deepEqual(
      vm.deferredActions.map((action) => action.label),
      SEND_GATE_DEFERRED_ACTIONS.map((action) => action.label)
    );
    assert.deepEqual(vm.deferredActions.map((action) => action.id), ["signature", "pdf", "payment"]);
  });

  test("copy uses approved send gate language", () => {
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: false,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: null,
    });

    assert.equal(vm.heading, SEND_GATE_PANEL_TITLE);
    assert.equal(vm.summary, SEND_GATE_PANEL_INTRO);
    const serialized = JSON.stringify(vm);
    assert.doesNotMatch(serialized, /sent to customer|email sent|send complete|customer notified/i);
    assert.doesNotMatch(serialized, /token_hash|raw_token|rawToken|\/approve\//i);
  });
});

describe("R18D3B send gate delivery readiness", () => {
  test("deliveryEnabled follows email config only", () => {
    const configured = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: null,
      emailDeliveryConfigured: true,
    });
    const notConfigured = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: previewReadiness(),
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: null,
      emailDeliveryConfigured: false,
    });

    assert.equal(configured.deliveryEnabled, true);
    assert.equal(notConfigured.deliveryEnabled, false);
  });
});

describe("R18D1 send gate guardrails", () => {
  test("view model never exposes forbidden token fields", () => {
    const scenarios = [
      buildProposalSendGateReadinessViewModel({
        loading: true,
        hasSentSnapshot: false,
        sendFreezeReadiness: null,
        previewReadiness: null,
        recipientEmail: null,
        customerFirstName: null,
        companyName: null,
        projectAddress: null,
      }),
      buildProposalSendGateReadinessViewModel({
        hasSentSnapshot: false,
        sendFreezeReadiness: readySendFreeze({ ready: false, blockingReasons: ["Blocked"] }),
        previewReadiness: previewReadiness({ pricingComplete: false }),
        recipientEmail: null,
        customerFirstName: null,
        companyName: null,
        projectAddress: null,
      }),
      buildProposalSendGateReadinessViewModel({
        hasSentSnapshot: true,
        sendFreezeReadiness: readySendFreeze(),
        previewReadiness: previewReadiness(),
        recipientEmail: "ready@example.com",
        customerFirstName: "Ready",
        companyName: "Ready Co",
        projectAddress: "1 Ready St",
      }),
    ];

    for (const vm of scenarios) {
      const serialized = JSON.stringify(vm);
      assert.doesNotMatch(serialized, /token_hash|raw_token|rawToken/);
      assert.doesNotMatch(serialized, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    }
  });

  test("R18D1 source files avoid forbidden send/freeze/mint imports", () => {
    for (const relativePath of R18D1_SOURCE_FILES) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      assert.doesNotMatch(source, /\bResend\b|from ["']resend["']/);
      assert.doesNotMatch(source, /freezeDraftToSentSnapshot/);
      assert.doesNotMatch(source, /mintProposalPublicAccessToken/);
      assert.doesNotMatch(source, /proposalPublicAccessTokenMintStore/);
      assert.doesNotMatch(source, /createAdminClient/);
      assert.doesNotMatch(source, /\/approve\/\[token\]|\/approve\//);
    }
  });

  test("send gate panel mounts on contractor preview only", () => {
    const previewClient = readFileSync(
      new URL(
        "../tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const sendDrawer = readFileSync(
      new URL(
        "../tools/roofing/proposals/preview/ProposalCustomerPreviewSendSharingDrawer.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const panel = readFileSync(
      new URL(
        "../tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const builderClient = readFileSync(
      new URL(
        "../tools/roofing/proposals/builder/ProposalBuilderClient.tsx",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(previewClient, /ProposalCustomerPreviewSendSharingDrawer/);
    assert.match(sendDrawer, /ProposalCustomerPreviewSendGatePanel/);
    assert.match(panel, /Send proposal/);
    assert.match(panel, /A secure proposal link will be included when sent/);
    assert.match(panel, /handlePrepareCustomerLink/);
    assert.match(panel, /\/api\/proposals\/send-prep/);
    assert.match(panel, /\/api\/proposals\/send/);
    assert.match(panel, /ProposalCustomerPreviewDeliveryHistorySection/);
    assert.match(panel, /deliveryHistoryRefreshKey/);
    assert.match(panel, /handleSendProposalByEmail/);
    assert.match(panel, /data-preview-email-composer/);
    assert.doesNotMatch(builderClient, /ProposalCustomerPreviewSendGatePanel/);
  });
});
