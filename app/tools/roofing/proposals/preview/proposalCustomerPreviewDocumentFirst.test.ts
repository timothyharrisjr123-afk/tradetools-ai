/**
 * Block 5 Roofr-first Preview — shell / document / drawer / readiness guards.
 *
 * Run: npx tsx --test app/tools/roofing/proposals/preview/*.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_COMPACT_READINESS_COPY,
  CUSTOMER_PREVIEW_DRAFT_NOTICE,
  CUSTOMER_PREVIEW_PAGE_TITLE,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
  CUSTOMER_PREVIEW_SEND_SHARING_LABEL,
} from "@/app/lib/proposalBuilderDocumentIa";

function readPreviewSource(rel: string): string {
  return readFileSync(path.join(process.cwd(), "app/tools/roofing/proposals/preview", rel), "utf8");
}

const COCKPIT_STRINGS = [
  /readiness checklist/i,
  /sent snapshot/i,
  /needs sent snapshot/i,
  /email delivery is not configured/i,
  /company logo is missing/i,
  /message preview/i,
  /coming later/i,
  /custom text page/i,
  /should be reviewed/i,
  /pricing readiness/i,
  /scope decisions/i,
  /guardrail/i,
  /workbench/i,
];

const ACTION_STRINGS = [
  /Edit quantity/i,
  /Set quantity/i,
  /Remove from proposal/i,
  /\bRestore\b/,
  /Hide from customer/i,
];

describe("Block 5 Roofr-first — Preview shell and document guards", () => {
  test("page title and quiet draft status", () => {
    assert.equal(CUSTOMER_PREVIEW_PAGE_TITLE, "Customer proposal preview");
    assert.equal(CUSTOMER_PREVIEW_DRAFT_NOTICE, "Draft preview · Not sent");
    assert.equal(CUSTOMER_PREVIEW_SEND_SHARING_LABEL, "Send / sharing");
  });

  test("Send / sharing is closed by default and opens a drawer, not a long page below the document", () => {
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /setSendSharingOpen\] = useState\(false\)/);
    assert.match(client, /ProposalCustomerPreviewSendSharingDrawer/);
    assert.doesNotMatch(client, /CONTRACTOR_TOOLS_HEADING/);
    // Drawer is a sibling overlay — panels are not stacked under the document in Client
    assert.doesNotMatch(client, /border-t border-slate-200\/80 pt-8[\s\S]*ProposalCustomerPreviewPublicAccessPanel/);

    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(drawer, /data-preview-send-sharing-drawer/);
    assert.match(drawer, /fixed inset-0/);
    assert.match(drawer, /role="dialog"/);
    assert.match(drawer, /hideDeferredActions/);
    assert.match(drawer, /ProposalCustomerPreviewPublicAccessPanel/);
    assert.match(drawer, /ProposalCustomerPreviewSendGatePanel/);
  });

  test("compact readiness uses contractor-safe copy and Return to Builder outside the document", () => {
    assert.match(CUSTOMER_PREVIEW_COMPACT_READINESS_COPY, /quantities before totals are final/i);
    assert.equal(CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION, "Return to Builder");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /data-preview-compact-readiness/);
    assert.match(client, /CUSTOMER_PREVIEW_COMPACT_READINESS_COPY/);
    assert.match(client, /CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION/);
    assert.doesNotMatch(client, /pricing readiness|guardrail|money token|sent snapshot/i);
  });

  test("customer document omits empty-state helpers and centers the proposal hero", () => {
    const doc = readPreviewSource("ProposalCustomerPreviewDocument.tsx");
    assert.doesNotMatch(doc, /will appear here/);
    assert.doesNotMatch(doc, /BUILDER_CANVAS_PLACEHOLDER/);
    assert.doesNotMatch(doc, /emptyStateForPageType/);
    assert.match(doc, /max-w-3xl/);
    assert.match(doc, /data-preview-customer-document/);
    for (const pattern of COCKPIT_STRINGS) {
      assert.doesNotMatch(doc, pattern);
    }
    for (const pattern of ACTION_STRINGS) {
      assert.doesNotMatch(doc, pattern);
    }
  });

  test("estimate document omits upgrades, partial pricing, and contractor actions", () => {
    const estimate = readPreviewSource("ProposalCustomerPreviewEstimateDocument.tsx");
    assert.doesNotMatch(estimate, /CUSTOMER_PREVIEW_ESTIMATE_UPGRADES/);
    assert.doesNotMatch(estimate, /CUSTOMER_PREVIEW_ESTIMATE_PARTIAL_PRICING_NOTE/);
    assert.doesNotMatch(estimate, /upgradeSections/);
    assert.doesNotMatch(estimate, /Pricing incomplete/i);
    for (const pattern of ACTION_STRINGS) {
      assert.doesNotMatch(estimate, pattern);
    }
    assert.doesNotMatch(estimate, /\bCurrent\b/);
    assert.doesNotMatch(estimate, /\bAvailable\b/);
    assert.doesNotMatch(estimate, /Choose starting package/i);
  });

  test("line list is itemized Item/Price without edit chrome", () => {
    const lines = readPreviewSource("ProposalCustomerPreviewLineList.tsx");
    assert.match(lines, /\bItem\b/);
    assert.match(lines, /\bPrice\b/);
    for (const pattern of ACTION_STRINGS) {
      assert.doesNotMatch(lines, pattern);
    }
  });

  test("Send / sharing panels hide Coming later when used from Preview drawer", () => {
    const publicPanel = readPreviewSource("ProposalCustomerPreviewPublicAccessPanel.tsx");
    const sendGate = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.match(publicPanel, /hideDeferredActions/);
    assert.match(sendGate, /hideDeferredActions/);
    assert.match(publicPanel, /!hideDeferredActions \?/);
    assert.match(sendGate, /!hideDeferredActions \?/);
  });
});
