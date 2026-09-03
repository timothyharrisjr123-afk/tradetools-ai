/**
 * Contractor-facing Proposal Preview — V2C1 document-first shell rules.
 *
 * Run: npx tsx --test app/tools/roofing/proposals/preview/*.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT,
  CUSTOMER_PREVIEW_DRAFT_STATUS,
  CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING,
  CUSTOMER_PREVIEW_PAGE_TITLE,
  CUSTOMER_PREVIEW_READY_HEADING,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
  CUSTOMER_PREVIEW_SEND_LABEL,
} from "@/app/lib/proposalBuilderDocumentIa";

function readPreviewSource(rel: string): string {
  return readFileSync(path.join(process.cwd(), "app/tools/roofing/proposals/preview", rel), "utf8");
}

const CUSTOMER_DOCUMENT_FILES = [
  "ProposalCustomerPreviewDocument.tsx",
  "ProposalCustomerPreviewPacket.tsx",
  "ProposalCustomerPreviewPacketCover.tsx",
  "ProposalCustomerPreviewPackageStrip.tsx",
  "ProposalCustomerPreviewEstimateTable.tsx",
  "ProposalCustomerPreviewPacketSection.tsx",
  "proposalCustomerPacketStyles.ts",
];

const DEFAULT_PAGE_FILES = [
  "ProposalCustomerPreviewClient.tsx",
  "ProposalPreviewHeader.tsx",
  "ProposalPreviewActionGroup.tsx",
  "ProposalPreviewReadinessSummary.tsx",
  "ProposalPreviewReviewSurface.tsx",
];

const ACTION_STRINGS = [
  /Edit quantity/i,
  /Set quantity/i,
  /Remove from proposal/i,
  /Hide from customer/i,
  /row menu/i,
];

describe("Contractor-facing Proposal Preview workspace", () => {
  test("1. default page is contractor-facing Proposal Preview shell", () => {
    assert.equal(CUSTOMER_PREVIEW_PAGE_TITLE, "Proposal Preview");
    assert.equal(CUSTOMER_PREVIEW_DRAFT_STATUS, "Draft");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /data-preview-contractor-workspace/);
    assert.match(client, /data-preview-shell-v2c1/);
    assert.match(client, /ProposalPreviewHeader/);
    assert.match(client, /ProposalPreviewReviewSurface/);
    assert.doesNotMatch(client, /PREVIEW_UNIFIED_SURFACE/);
    assert.doesNotMatch(client, /data-preview-unified-surface/);
    assert.doesNotMatch(client, /Roof replacement proposal/);
    assert.doesNotMatch(client, /ProposalPreviewCanvas/);
    assert.doesNotMatch(client, /ProposalPreviewReviewPanel/);
    const appPage = readPreviewSource("ProposalCustomerPreviewAppPage.tsx");
    assert.match(appPage, /activeNav="jobs"/);
    assert.doesNotMatch(appPage, /activeNav="templates"/);
  });

  test("2. compact command bar owns review context", () => {
    const header = readPreviewSource("ProposalPreviewHeader.tsx");
    assert.match(header, /data-preview-command-bar/);
    assert.match(header, /data-preview-page-title/);
    assert.match(header, /sr-only/);
    assert.match(header, /CUSTOMER_PREVIEW_PAGE_TITLE/);
    assert.match(header, /data-preview-header-package/);
    assert.match(header, /data-preview-header-total/);
    assert.match(header, /data-preview-draft-status/);
    assert.match(header, /sentFrozenChrome\.statusLabel/);
    assert.match(header, /data-preview-sent-frozen-kind/);
    assert.doesNotMatch(header, /Not sent yet/);
    assert.doesNotMatch(header, /lastSavedLabel/);
    assert.doesNotMatch(header, /Clock3/);
    assert.doesNotMatch(header, /Roof replacement proposal/);
  });

  test("3. customer proposal title appears only inside customer preview", () => {
    const cover = readPreviewSource("ProposalCustomerPreviewPacketCover.tsx");
    assert.match(cover, /data-preview-document-title/);
    for (const file of DEFAULT_PAGE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /data-preview-document-title/);
    }
  });

  test("3b. customer and project details render as a balanced proposal snapshot", () => {
    const cover = readPreviewSource("ProposalCustomerPreviewPacketCover.tsx");
    assert.match(cover, /data-preview-project-snapshot/);
    assert.match(cover, /data-preview-prepared-for/);
    assert.match(cover, /data-preview-project-info/);
    assert.match(cover, /data-preview-project-scope/);
    assert.match(cover, /data-preview-project-package/);
    assert.match(cover, />Prepared for</);
    assert.match(cover, />Property</);
    assert.match(cover, />Project</);
    assert.match(cover, />Package</);
  });

  test("4. healthy readiness is quiet; blocked truth remains", () => {
    assert.equal(CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING, "Needs review before sending");
    assert.equal(CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION, "Review in Builder");
    assert.equal(CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT, "Company logo missing");
    const summary = readPreviewSource("ProposalPreviewReadinessSummary.tsx");
    assert.match(summary, /data-preview-compact-readiness/);
    assert.match(summary, /data-preview-readiness-blocked/);
    assert.match(summary, /if \(!needsReview\)/);
    assert.match(summary, /return null/);
    assert.doesNotMatch(summary, /CUSTOMER_PREVIEW_READY_HEADING/);
    assert.doesNotMatch(summary, /Recipient ready/);
    assert.doesNotMatch(summary, /Customer proposal is ready for final review/);
    assert.doesNotMatch(summary, /Ready to send/);
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /ProposalPreviewReadinessSummary/);
    for (const file of CUSTOMER_DOCUMENT_FILES) {
      assert.doesNotMatch(readPreviewSource(file), /data-preview-compact-readiness/);
    }
  });

  test("4b. blocked readiness semantics preserved for shell + Send drawer", () => {
    const summary = readPreviewSource("ProposalPreviewReadinessSummary.tsx");
    const sendPanel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");

    assert.doesNotMatch(summary, /companyLogoMissing/);
    assert.match(summary, /!hasRecipientEmail/);
    assert.match(summary, /CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING/);
    assert.doesNotMatch(summary, /CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT/);
    assert.match(client, /companyLogoMissing=\{companyLogoMissing\}/);

    // V2C2 — Send owns blocker surface only when blocked (no permanent Ready card).
    // Missing logo is a freeze warning, not a Send-blocking review hint.
    assert.match(sendPanel, /CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING/);
    assert.doesNotMatch(sendPanel, /CUSTOMER_PREVIEW_READY_HEADING/);
    assert.doesNotMatch(sendPanel, /CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT/);
    assert.match(sendPanel, /disabled=\{!canSendProposalEmail\}/);
    assert.match(sendPanel, /data-preview-send-blocker/);
    assert.match(sendPanel, /data-preview-send-return-to-builder/);
    assert.equal(CUSTOMER_PREVIEW_READY_HEADING, "Ready to send");

    for (const source of [summary, sendPanel]) {
      assert.doesNotMatch(source, /sent snapshot/i);
      assert.doesNotMatch(source, /customer view gate/i);
      assert.doesNotMatch(source, /pricing scope/i);
      assert.doesNotMatch(source, /internal readiness/i);
    }
  });

  test("5. full readiness checklist is not shown by default", () => {
    for (const file of DEFAULT_PAGE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /Readiness checklist/);
      assert.doesNotMatch(source, /Needs sent snapshot/);
      assert.doesNotMatch(source, /sent proposal snapshot/i);
    }
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    const sendPanel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.match(drawer, /ProposalCustomerPreviewSendGatePanel/);
    assert.match(sendPanel, /data-preview-delivery-blocker/);
    assert.doesNotMatch(sendPanel, /data-preview-send-checklist/);
    assert.doesNotMatch(sendPanel, />Readiness checklist</);
  });

  test("6. full email / message form is not shown by default", () => {
    for (const file of DEFAULT_PAGE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /Message preview/);
      assert.doesNotMatch(source, /Send proposal by email/);
      assert.doesNotMatch(source, /ProposalCustomerPreviewSendGatePanel/);
    }
  });

  test("7. Send opens existing drawer; primary label is Send", () => {
    assert.equal(CUSTOMER_PREVIEW_SEND_LABEL, "Send");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /ProposalCustomerPreviewSendSharingDrawer/);
    assert.match(client, /sendSharingOpen/);
    const header = readPreviewSource("ProposalPreviewHeader.tsx");
    assert.match(header, /ProposalPreviewActionGroup/);
    const actionGroup = readPreviewSource("ProposalPreviewActionGroup.tsx");
    assert.match(actionGroup, /data-preview-send-sharing-toggle/);
    assert.match(actionGroup, /data-preview-send-cta/);
    assert.match(actionGroup, /CUSTOMER_PREVIEW_SEND_LABEL/);
    assert.doesNotMatch(actionGroup, /Send \/ sharing/);
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(drawer, /data-preview-send-sharing-drawer/);
    assert.match(drawer, /ProposalCustomerPreviewSendGatePanel/);
  });

  test("7b. disabled Sign / PDF are absent from primary Preview surface", () => {
    const actions = readPreviewSource("ProposalPreviewActionGroup.tsx");
    assert.match(actions, /data-preview-action-group/);
    assert.doesNotMatch(actions, /Sign in person/);
    assert.doesNotMatch(actions, /Download PDF/);
    assert.doesNotMatch(actions, /data-preview-future-action/);
    assert.match(actions, /CUSTOMER_PREVIEW_SEND_LABEL/);
    assert.match(actions, /min-h-\[44px\]/);
  });

  test("7c. Send opens a focused delivery composer without backend-facing copy", () => {
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    const sendPanel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.match(drawer, /data-preview-send-sheet-v2c2/);
    assert.match(drawer, /resolveSendGateSheetTitle/);
    assert.match(drawer, /sentFrozenChrome\.statusLabel/);
    assert.match(drawer, /Customer:/);
    assert.doesNotMatch(drawer, /data-preview-review-tabs/);
    assert.doesNotMatch(drawer, /\["link", "Link"/);
    assert.doesNotMatch(drawer, /\["activity", "Activity"/);
    assert.match(sendPanel, /data-preview-send-gate-v2c2/);
    assert.match(sendPanel, /data-preview-delivery-composer/);
    assert.match(sendPanel, /data-preview-delivery-recipient/);
    assert.match(sendPanel, /data-preview-email-composer/);
    assert.match(sendPanel, /data-preview-email-subject/);
    assert.match(sendPanel, /data-preview-email-message/);
    assert.match(sendPanel, /data-preview-send-proposal/);
    assert.match(sendPanel, /A secure proposal link will be included when sent/);
    assert.match(sendPanel, /disabled=\{!canSendProposalEmail\}/);
    assert.match(sendPanel, /CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING/);
    assert.doesNotMatch(sendPanel, />Sent snapshot</);
    assert.doesNotMatch(sendPanel, />Customer view</);
    assert.doesNotMatch(sendPanel, />Pricing & scope</);
    assert.doesNotMatch(sendPanel, /Email sending is not configured/);
  });

  test("7d. Link and Activity panels remain available for later slices, not peer tabs", () => {
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    const sendPanel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    const history = readPreviewSource("ProposalCustomerPreviewDeliveryHistorySection.tsx");
    assert.doesNotMatch(drawer, /ProposalCustomerPreviewPublicAccessPanel/);
    assert.match(sendPanel, /data-preview-create-secure-link|data-preview-send-link-optional/);
    assert.match(sendPanel, /ProposalCustomerPreviewDeliveryHistorySection/);
    for (const source of [drawer, history]) {
      assert.doesNotMatch(source, /\bViewed\b/);
      assert.doesNotMatch(source, /\bOpened\b/);
      assert.doesNotMatch(source, /\bSigned\b/);
      assert.doesNotMatch(source, /\bWon\b/);
    }
  });

  test("8. Send sheet has no peer tabs; delivery history stays demoted inside Send", () => {
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    const sendPanel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.doesNotMatch(drawer, /data-preview-review-tabs/);
    assert.doesNotMatch(drawer, /\["link", "Link", Link2\]/);
    assert.doesNotMatch(drawer, /\["activity", "Activity", Clock3\]/);
    assert.doesNotMatch(drawer, /ProposalCustomerPreviewPublicAccessPanel/);
    assert.match(drawer, /ProposalCustomerPreviewSendGatePanel/);
    assert.match(sendPanel, /data-preview-delivery-history-quiet/);
    assert.match(sendPanel, /ProposalCustomerPreviewDeliveryHistorySection/);
    for (const file of DEFAULT_PAGE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /ProposalCustomerPreviewPublicAccessPanel/);
      assert.doesNotMatch(source, /ProposalCustomerPreviewDeliveryHistorySection/);
      assert.doesNotMatch(source, /data-preview-review-tabs/);
    }
  });

  test("9. no Proposal packet admin framing; document canvas is direct", () => {
    for (const file of DEFAULT_PAGE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /Desktop/);
      assert.doesNotMatch(source, /Mobile/);
      assert.doesNotMatch(source, /data-preview-mode-controls/);
      assert.doesNotMatch(source, /zoom/i);
      assert.doesNotMatch(source, /100%/);
    }
    const surface = readPreviewSource("ProposalPreviewReviewSurface.tsx");
    assert.match(surface, /data-preview-review-surface/);
    assert.match(surface, /data-preview-customer-document/);
    assert.doesNotMatch(surface, /Proposal packet/);
    assert.doesNotMatch(surface, /Review the proposal content before sending\./);
    assert.doesNotMatch(surface, /Customer proposal preview/);
    assert.doesNotMatch(surface, /What the customer will receive/);
    assert.doesNotMatch(surface, /This is what the customer will see/);
    assert.doesNotMatch(surface, /Customer view preview/);
    assert.doesNotMatch(surface, /Customer-safe preview/);
  });

  test("10. customer preview has no internal controls or backend words", () => {
    for (const file of CUSTOMER_DOCUMENT_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /Back to Builder/);
      assert.doesNotMatch(source, /Review in Builder/);
      assert.doesNotMatch(source, /data-preview-status-strip/);
      assert.doesNotMatch(source, /Review & send/);
      assert.doesNotMatch(source, /delivery history/i);
      assert.doesNotMatch(source, /sent snapshot/i);
      assert.doesNotMatch(source, /Needs sent snapshot/);
      assert.doesNotMatch(source, /\bmanual quantity\b/i);
      assert.doesNotMatch(source, /needs quantity/i);
      assert.doesNotMatch(source, /Sign in person/);
      assert.doesNotMatch(source, /Download PDF/);
      for (const pattern of ACTION_STRINGS) {
        assert.doesNotMatch(source, pattern);
      }
    }
  });

  test("11. selected package and estimate still render; totals gated", () => {
    const packageStrip = readPreviewSource("ProposalCustomerPreviewPackageStrip.tsx");
    assert.match(packageStrip, /Selected package|package/i);
    const table = readPreviewSource("ProposalCustomerPreviewEstimateTable.tsx");
    assert.match(table, />Item</);
    assert.match(table, />Qty</);
    assert.match(table, />Price</);
    assert.match(table, /totals\.show \?/);
    assert.match(table, /totals\.discountLabel \?/);
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    const totalsOwner = readFileSync(
      path.join(process.cwd(), "app/lib/proposalCustomerPreviewViewModel.ts"),
      "utf8"
    );
    assert.match(client, /resolveProposalCustomerPreviewSelectedTotalLabel/);
    assert.match(totalsOwner, /customer_total_cents/);
    assert.match(client, /ProposalCustomerPreviewDocumentView/);
    assert.match(client, /PacketCover|ProposalCustomerPreviewDocumentView/);
  });

  test("12. no fake unsupported features on default or document", () => {
    const files = [
      ...DEFAULT_PAGE_FILES,
      ...CUSTOMER_DOCUMENT_FILES,
      "ProposalCustomerPreviewSendSharingDrawer.tsx",
      "proposalPreviewWorkspaceStyles.ts",
    ];
    for (const file of files) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /\bQR\b/, file);
      assert.doesNotMatch(source, /Payment schedule/i, file);
      assert.doesNotMatch(source, /e-signature/i, file);
      assert.doesNotMatch(source, /Viewed\/signed/i, file);
      assert.doesNotMatch(source, /co-signer/i, file);
      assert.doesNotMatch(source, /Choose package/i, file);
      assert.doesNotMatch(source, /Optional upgrades/i, file);
      assert.doesNotMatch(source, /Customer selected/i, file);
    }
  });

  test("13. preserved customer packet modules remain mounted", () => {
    const document = readPreviewSource("ProposalCustomerPreviewDocument.tsx");
    assert.match(document, /ProposalCustomerPreviewPacketCover/);
    assert.match(document, /ProposalCustomerPreviewPackageStrip/);
    assert.match(document, /ProposalCustomerPreviewEstimateTable/);
    assert.match(document, /ProposalCustomerPreviewPacketSection/);
    assert.doesNotMatch(document, /ProposalCustomerPreviewTrustBridge/);
  });

  test("Preview customer document does not import Builder visual chrome", () => {
    for (const file of CUSTOMER_DOCUMENT_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(
        source,
        /from ["']\.\.\/builder\/proposalBuilderConstants["']/
      );
    }
  });
});
