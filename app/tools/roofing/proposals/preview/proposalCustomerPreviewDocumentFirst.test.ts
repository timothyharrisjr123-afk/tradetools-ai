/**
 * Block 5 corrective — Preview document-first / cockpit strip guards.
 *
 * Run: npx tsx --test app/tools/roofing/proposals/preview/*.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_PAGE_TITLE,
  CUSTOMER_PREVIEW_SEND_SHARING_LABEL,
} from "@/app/lib/proposalBuilderDocumentIa";

function readPreviewSource(rel: string): string {
  return readFileSync(path.join(process.cwd(), "app/tools/roofing/proposals/preview", rel), "utf8");
}

describe("Block 5 corrective — Preview document-first source guards", () => {
  test("page title is Customer proposal preview", () => {
    assert.equal(CUSTOMER_PREVIEW_PAGE_TITLE, "Customer proposal preview");
  });

  test("Send / sharing is collapsed by default and mounts tools only when open", () => {
    assert.equal(CUSTOMER_PREVIEW_SEND_SHARING_LABEL, "Send / sharing");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /sendSharingOpen/);
    assert.match(client, /setSendSharingOpen\] = useState\(false\)/);
    assert.match(client, /CUSTOMER_PREVIEW_SEND_SHARING_LABEL/);
    assert.match(client, /\{sendSharingOpen \?/);
    assert.doesNotMatch(client, /CONTRACTOR_TOOLS_HEADING/);
    // Public/Send panels must not render unless the panel is open
    assert.match(client, /\{sendSharingOpen \? \([\s\S]*ProposalCustomerPreviewPublicAccessPanel/);
  });

  test("customer document omits empty-state placeholder copy helpers", () => {
    const doc = readPreviewSource("ProposalCustomerPreviewDocument.tsx");
    assert.doesNotMatch(doc, /will appear here/);
    assert.doesNotMatch(doc, /BUILDER_CANVAS_PLACEHOLDER/);
    assert.doesNotMatch(doc, /emptyStateForPageType/);
  });

  test("estimate document omits upgrade and partial-pricing chrome", () => {
    const estimate = readPreviewSource("ProposalCustomerPreviewEstimateDocument.tsx");
    assert.doesNotMatch(estimate, /CUSTOMER_PREVIEW_ESTIMATE_UPGRADES/);
    assert.doesNotMatch(estimate, /CUSTOMER_PREVIEW_ESTIMATE_PARTIAL_PRICING_NOTE/);
    assert.doesNotMatch(estimate, /upgradeSections/);
  });
});
