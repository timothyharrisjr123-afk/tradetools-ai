/**
 * V2C3 — Preview delivery history / request ownership.
 *
 * Run: npx tsx --test app/tools/roofing/proposals/preview/proposalCustomerPreviewDeliveryRequest.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_DELIVERY_ACTIVITY_LABEL,
  CUSTOMER_PREVIEW_REQUEST_AWARENESS_ACTION,
} from "@/app/lib/proposalBuilderDocumentIa";
import { PROPOSAL_DELIVERY_HISTORY_API_PATH } from "@/app/lib/proposalDeliveryHistoryClient";

function readPreviewSource(rel: string): string {
  return readFileSync(path.join(process.cwd(), "app/tools/roofing/proposals/preview", rel), "utf8");
}

describe("V2C3 delivery history / request ownership", () => {
  test("delivery history fetch path and empty state remain intact", () => {
    const section = readPreviewSource("ProposalCustomerPreviewDeliveryHistorySection.tsx");
    const client = readFileSync(
      path.join(process.cwd(), "app/lib/proposalDeliveryHistoryClient.ts"),
      "utf8"
    );
    assert.equal(PROPOSAL_DELIVERY_HISTORY_API_PATH, "/api/proposals/delivery-attempts");
    assert.match(section, /fetchProposalDeliveryHistory/);
    assert.match(section, /data-preview-delivery-history-empty/);
    assert.match(section, /history\.emptyStateTitle/);
    assert.match(section, /getProposalDeliveryHistoryEarlierAttempts/);
    assert.match(section, /data-preview-delivery-history-list/);
    assert.doesNotMatch(section, /\/api\/proposals\/send["']/);
    assert.doesNotMatch(client, /\/api\/proposals\/send["']/);
  });

  test("Send keeps Delivery activity as quiet secondary with compact embedded history", () => {
    assert.equal(CUSTOMER_PREVIEW_DELIVERY_ACTIVITY_LABEL, "Delivery activity");
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    const section = readPreviewSource("ProposalCustomerPreviewDeliveryHistorySection.tsx");
    assert.match(panel, /data-preview-delivery-history-quiet/);
    assert.match(panel, /data-preview-delivery-activity-v2c3/);
    assert.match(panel, /CUSTOMER_PREVIEW_DELIVERY_ACTIVITY_LABEL/);
    assert.match(panel, /onSummaryChange=\{setDeliveryActivitySummary\}/);
    assert.match(panel, /embedded/);
    assert.match(section, /embedded \? "embedded" : "standalone"/);
    assert.match(section, /compact=\{embedded\}/);
    assert.doesNotMatch(panel, /ProposalPreviewRequestAwareness/);
    assert.doesNotMatch(panel, /onMarkSeen|onDismiss|Mark seen|Dismiss/);
  });

  test("Preview request awareness is read-only and links to Job Card", () => {
    assert.equal(CUSTOMER_PREVIEW_REQUEST_AWARENESS_ACTION, "Review on Job Card");
    const awareness = readPreviewSource("ProposalPreviewRequestAwareness.tsx");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    const sendPanel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");

    assert.match(client, /ProposalPreviewRequestAwareness/);
    assert.match(awareness, /data-preview-request-awareness/);
    assert.match(awareness, /data-preview-request-review-on-job-card/);
    assert.match(awareness, /CUSTOMER_PREVIEW_REQUEST_AWARENESS_ACTION/);
    assert.match(awareness, /buildJobCardHref\(jobId, \{ tab: "proposals" \}\)/);
    assert.match(awareness, /partitionCustomerRequestReviewItems/);
    assert.doesNotMatch(awareness, /markSeen|dismiss|onMarkSeen|onDismiss/);
    assert.doesNotMatch(awareness, /updateProposalCustomerRequestStatus/);
    assert.doesNotMatch(awareness, /\/api\/jobs\/attention/);
    assert.doesNotMatch(sendPanel, /ProposalPreviewRequestAwareness|ProposalCustomerPreviewCustomerRequestsSection/);
    assert.doesNotMatch(drawer, /ProposalPreviewRequestAwareness|markSeen|onDismiss/);
  });

  test("legacy Preview request-management section is demoted to awareness re-export", () => {
    const legacy = readPreviewSource("ProposalCustomerPreviewCustomerRequestsSection.tsx");
    assert.match(legacy, /ProposalPreviewRequestAwareness/);
    assert.match(legacy, /@deprecated V2C3/);
    assert.doesNotMatch(legacy, /onMarkSeen|onDismiss|CUSTOMER_REQUEST_MARK_SEEN_LABEL/);
  });

  test("no customer viewed/opened invent or lifecycle mutation in Preview delivery UI", () => {
    const section = readPreviewSource("ProposalCustomerPreviewDeliveryHistorySection.tsx");
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    const awareness = readPreviewSource("ProposalPreviewRequestAwareness.tsx");
    for (const source of [section, panel, awareness]) {
      assert.doesNotMatch(source, /\bViewed\b/);
      assert.doesNotMatch(source, /\bOpened\b/);
      assert.doesNotMatch(source, /jobs\.stage|selected_option_id\s*=/);
      assert.doesNotMatch(source, /Sent to customer|Customer received|Delivered to inbox/i);
    }
  });
});
