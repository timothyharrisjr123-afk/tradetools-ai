/**
 * V2C2 — Focused Send action / blocker ownership.
 *
 * Run: npx tsx --test app/tools/roofing/proposals/preview/proposalCustomerPreviewSendAction.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
} from "@/app/lib/proposalBuilderDocumentIa";

function readPreviewSource(rel: string): string {
  return readFileSync(path.join(process.cwd(), "app/tools/roofing/proposals/preview", rel), "utf8");
}

describe("V2C2 focused Send action", () => {
  test("Send drawer opens as focused sheet without peer tabs", () => {
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");

    assert.match(client, /sendSharingOpen/);
    assert.match(client, /setSendSharingOpen\(true\)/);
    assert.doesNotMatch(client, /sendSharingTab/);
    assert.match(drawer, /data-preview-send-sheet-v2c2/);
    assert.match(drawer, /ProposalCustomerPreviewSendGatePanel/);
    assert.doesNotMatch(drawer, /data-preview-review-tabs/);
    assert.doesNotMatch(drawer, /activeTab/);
    assert.doesNotMatch(drawer, /ProposalCustomerPreviewPublicAccessPanel/);
    assert.doesNotMatch(drawer, /ProposalCustomerPreviewCustomerRequests/);
  });

  test("recipient and message truth remain send-time drafts from existing resolvers", () => {
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.match(panel, /resolveSendGateRecipientEmail/);
    assert.match(panel, /resolveSendGateCustomerName/);
    assert.match(panel, /readiness\.messagePreview\.subject/);
    assert.match(panel, /readiness\.messagePreview\.body/);
    assert.match(panel, /subjectDraft/);
    assert.match(panel, /bodyDraft/);
    assert.match(panel, /data-preview-delivery-recipient/);
    assert.match(panel, /data-preview-email-subject/);
    assert.match(panel, /data-preview-email-message/);
    assert.doesNotMatch(panel, /fetch\(["']\/api\/customers/);
    assert.doesNotMatch(panel, /updateCustomer/);
  });

  test("blocker surface is single grouped owner when blocked", () => {
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.equal(CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING, "Needs review before sending");
    assert.equal(CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION, "Review in Builder");
    assert.match(panel, /CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING/);
    assert.match(panel, /data-preview-send-blocker/);
    assert.match(panel, /data-preview-delivery-blocker/);
    assert.match(panel, /buildSendBlockerHints/);
    assert.match(panel, /Recipient email missing/);
    assert.match(panel, /need quantities/);
    assert.match(panel, /data-preview-send-return-to-builder/);
    assert.match(panel, /CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION/);
    assert.match(panel, /href=\{builderHref\}/);
    assert.doesNotMatch(panel, /CUSTOMER_PREVIEW_READY_HEADING/);
    assert.doesNotMatch(panel, /Add a recipient email before sending/);
    assert.doesNotMatch(panel, /Review required before sending/);
  });

  test("recipient missing hint and recipient card share the same toMissing truth", () => {
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    // Blocker hint input
    assert.match(
      panel,
      /recipientMissing:\s*readiness\.messagePreview\.toMissing/
    );
    // Recipient card presentation
    assert.match(
      panel,
      /readiness\.messagePreview\.toMissing\s*\?\s*"Recipient email needed"\s*:\s*readiness\.messagePreview\.to/
    );
    // Hint copy is gated on that same flag inside buildSendBlockerHints
    assert.match(panel, /if \(input\.recipientMissing\) \{\s*hints\.push\("Recipient email missing"\)/);
  });

  test("Send CTA disables only for readiness / in-flight / success; orchestration preserved", () => {
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.match(panel, /const canSendProposalEmail =\s*readiness\.canSend && !actionsLocked && !sendSuccess && Boolean\(recipientEmail\)/);
    assert.match(panel, /disabled=\{!canSendProposalEmail\}/);
    assert.match(panel, /data-preview-send-proposal/);
    assert.match(panel, /Send proposal/);
    assert.doesNotMatch(panel, /Send proposal by email/);
    assert.match(panel, /min-h-\[44px\]/);
    assert.match(panel, /\/api\/proposals\/send/);
    assert.match(panel, /\/api\/proposals\/send-prep/);
    assert.match(panel, /handleSendProposalByEmail/);
    assert.match(panel, /if \(!canSendProposalEmail \|\| !recipientEmail\)/);
    assert.match(panel, /setSendPending\(true\)/);
    assert.match(panel, /data-preview-send-error/);
    assert.match(panel, /data-preview-send-success/);
    assert.match(panel, /setSendErrorMessage\(null\)/);
    assert.match(panel, /setSendPending\(false\)/);
  });

  test("secure-link requirement stays optional contextual path inside Send", () => {
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    assert.match(panel, /handlePrepareCustomerLink/);
    assert.match(panel, /data-preview-send-link-optional/);
    assert.match(panel, /data-preview-create-secure-link/);
    assert.match(panel, /A secure proposal link will be included when sent/);
    assert.match(panel, /SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL/);
  });

  test("delivery history stays wired but demoted; request semantics not promoted", () => {
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(panel, /ProposalCustomerPreviewDeliveryHistorySection/);
    assert.match(panel, /deliveryHistoryRefreshKey/);
    assert.match(panel, /setDeliveryHistoryRefreshKey\(\(key\) => key \+ 1\)/);
    assert.match(panel, /data-preview-delivery-history-quiet/);
    assert.doesNotMatch(panel, /customer-requests|Customer request/i);
    assert.doesNotMatch(drawer, /\["activity", "Activity"/);
    assert.doesNotMatch(drawer, /customer request/i);
  });
});
