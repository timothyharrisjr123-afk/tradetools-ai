/**
 * Contractor-facing Proposal Preview — product rules for the review-and-send workspace.
 *
 * Run: npx tsx --test app/tools/roofing/proposals/preview/*.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_DRAFT_NOTICE,
  CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING,
  CUSTOMER_PREVIEW_PAGE_TITLE,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
  CUSTOMER_PREVIEW_SEND_SHARING_LABEL,
} from "@/app/lib/proposalBuilderDocumentIa";

function readPreviewSource(rel: string): string {
  return readFileSync(path.join(process.cwd(), "app/tools/roofing/proposals/preview", rel), "utf8");
}

const CUSTOMER_DOCUMENT_FILES = [
  "ProposalCustomerPreviewDocument.tsx",
  "ProposalCustomerPreviewPacket.tsx",
  "ProposalCustomerPreviewPacketCover.tsx",
  "ProposalCustomerPreviewPackageStrip.tsx",
  "ProposalCustomerPreviewTrustBridge.tsx",
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
  test("1. default page is contractor-facing Proposal Preview", () => {
    assert.equal(CUSTOMER_PREVIEW_PAGE_TITLE, "Proposal Preview");
    assert.equal(CUSTOMER_PREVIEW_DRAFT_NOTICE, "Draft · Not sent");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /data-preview-contractor-workspace/);
    assert.match(client, /ProposalPreviewHeader/);
    assert.match(client, /ProposalPreviewReviewSurface/);
    assert.match(client, /PREVIEW_UNIFIED_SURFACE/);
    assert.match(client, /data-preview-unified-surface/);
    assert.doesNotMatch(client, /Roof replacement proposal/);
    assert.doesNotMatch(client, /ProposalPreviewCanvas/);
    assert.doesNotMatch(client, /ProposalPreviewReviewPanel/);
    const appPage = readPreviewSource("ProposalCustomerPreviewAppPage.tsx");
    assert.match(appPage, /activeNav="jobs"/);
    assert.doesNotMatch(appPage, /activeNav="templates"/);
  });

  test("2. app page title is Proposal Preview", () => {
    const header = readPreviewSource("ProposalPreviewHeader.tsx");
    assert.match(header, /data-preview-page-title/);
    assert.match(header, /CUSTOMER_PREVIEW_PAGE_TITLE/);
    assert.match(header, /data-preview-header-package/);
    assert.match(header, /data-preview-header-last-saved/);
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
    assert.match(cover, />Customer</);
    assert.match(cover, />Property</);
    assert.match(cover, />Project</);
    assert.match(cover, />Package</);
  });

  test("4. readiness summary appears outside customer preview", () => {
    assert.equal(CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING, "Needs review before sending");
    assert.equal(CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION, "Review in Builder");
    const summary = readPreviewSource("ProposalPreviewReadinessSummary.tsx");
    assert.match(summary, /data-preview-compact-readiness/);
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /ProposalPreviewReadinessSummary/);
    for (const file of CUSTOMER_DOCUMENT_FILES) {
      assert.doesNotMatch(readPreviewSource(file), /data-preview-compact-readiness/);
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

  test("7. Send / share details open only through Send / sharing", () => {
    assert.equal(CUSTOMER_PREVIEW_SEND_SHARING_LABEL, "Send / sharing");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /ProposalCustomerPreviewSendSharingDrawer/);
    assert.match(client, /sendSharingOpen/);
    const header = readPreviewSource("ProposalPreviewHeader.tsx");
    assert.match(header, /ProposalPreviewActionGroup/);
    const actionGroup = readPreviewSource("ProposalPreviewActionGroup.tsx");
    assert.match(actionGroup, /data-preview-send-sharing-toggle/);
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(drawer, /data-preview-send-sharing-drawer/);
    assert.match(drawer, /ProposalCustomerPreviewSendGatePanel/);
  });

  test("7b. Preview + Send actions distinguish active and future workflows", () => {
    const actions = readPreviewSource("ProposalPreviewActionGroup.tsx");
    assert.match(actions, /data-preview-action-group/);
    assert.match(actions, /Sign in person/);
    assert.match(actions, /Download PDF/);
    assert.match(actions, /data-preview-future-action="sign-in-person"/);
    assert.match(actions, /data-preview-future-action="download-pdf"/);
    assert.match(actions, /disabled/);
    assert.match(actions, /aria-disabled="true"/);
    assert.match(actions, /CUSTOMER_PREVIEW_SEND_SHARING_LABEL/);
    assert.doesNotMatch(actions, /onClick=.*sign|onClick=.*pdf/i);
  });

  test("7c. Send opens a premium delivery composer without backend-facing copy", () => {
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    const sendPanel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.match(drawer, /Send proposal/);
    assert.match(drawer, /Draft/);
    assert.match(drawer, /Not sent/);
    assert.match(sendPanel, /data-preview-delivery-composer/);
    assert.match(sendPanel, /data-preview-delivery-recipient/);
    assert.match(sendPanel, /data-preview-email-composer/);
    assert.match(sendPanel, /data-preview-email-subject/);
    assert.match(sendPanel, /data-preview-email-message/);
    assert.match(sendPanel, /A secure proposal link will be included when sent/);
    assert.match(sendPanel, /disabled=\{!canSendProposalEmail\}/);
    assert.match(sendPanel, /Review required before sending/);
    assert.doesNotMatch(sendPanel, />Sent snapshot</);
    assert.doesNotMatch(sendPanel, />Customer view</);
    assert.doesNotMatch(sendPanel, />Pricing & scope</);
    assert.doesNotMatch(sendPanel, /Email sending is not configured/);
  });

  test("7d. Link and Activity stay truthful and lightweight", () => {
    const linkPanel = readPreviewSource("ProposalCustomerPreviewPublicAccessPanel.tsx");
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    const history = readPreviewSource("ProposalCustomerPreviewDeliveryHistorySection.tsx");
    assert.match(linkPanel, /Customer proposal link/);
    assert.match(linkPanel, /Not created yet/);
    assert.match(linkPanel, /Create proposal link/);
    assert.match(linkPanel, /Copy link/);
    assert.match(linkPanel, /Open proposal/);
    assert.doesNotMatch(linkPanel, />Sent snapshot</);
    for (const source of [drawer, history]) {
      assert.doesNotMatch(source, /\bViewed\b/);
      assert.doesNotMatch(source, /\bOpened\b/);
      assert.doesNotMatch(source, /\bSigned\b/);
      assert.doesNotMatch(source, /\bWon\b/);
    }
  });

  test("8. Link / Activity details available in drawer, not dumped on default page", () => {
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(drawer, /data-preview-review-tabs/);
    assert.match(drawer, /\["link", "Link", Link2\]/);
    assert.match(drawer, /\["activity", "Activity", Clock3\]/);
    assert.match(drawer, /ProposalCustomerPreviewPublicAccessPanel/);
    assert.match(drawer, /ProposalCustomerPreviewDeliveryHistorySection/);
    for (const file of DEFAULT_PAGE_FILES) {
      const source = readPreviewSource(file);
      assert.doesNotMatch(source, /ProposalCustomerPreviewPublicAccessPanel/);
      assert.doesNotMatch(source, /ProposalCustomerPreviewDeliveryHistorySection/);
      assert.doesNotMatch(source, /data-preview-review-tabs/);
    }
  });

  test("9. no document viewer chrome — no Desktop/Mobile or zoom", () => {
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
    assert.match(surface, /Customer proposal preview/);
    assert.match(surface, /What the customer will receive/);
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
