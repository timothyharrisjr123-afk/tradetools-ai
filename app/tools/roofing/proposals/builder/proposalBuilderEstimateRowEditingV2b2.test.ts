/**
 * V2B2 — canonical estimate row quantity/scope editing.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderEstimateRowEditingV2b2.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("V2B2 canonical estimate row editing", () => {
  test("quantity editing begins from the estimate row and uses existing persist once", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const inline = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchInlineQuantityEditor.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(ready, /data-builder-qty-edit-trigger/);
    assert.match(ready, /ProposalBuilderWorkbenchInlineQuantityEditor/);
    assert.match(ready, /grid-template-areas:'name_menu'_'qty_price'/);
    assert.equal((ready.match(/data-builder-qty-edit-trigger/g) ?? []).length, 1);
    assert.match(inline, /data-builder-inline-quantity-editor/);
    assert.match(estimate, /handleApplyManualQuantity/);
    assert.match(estimate, /onApplyManualQuantity/);
    assert.match(client, /applyManualQuantityScopeDecision/);
    assert.match(inline, /if \(inFlight\) return/);
    assert.match(inline, /data-builder-set-quantity-save/);
    assert.match(inline, /data-builder-set-quantity-cancel/);
    assert.match(inline, /validateManualQuantityInput/);
    assert.match(inline, /role="alert"/);
  });

  test("Cancel writes nothing; failed save keeps the editor open", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const inline = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchInlineQuantityEditor.tsx"
    );
    assert.match(estimate, /onCancelSetQuantity=\{closeSetQuantity\}/);
    assert.match(estimate, /await onApplyManualQuantity/);
    assert.match(estimate, /setSetQuantityLineId\(null\)/);
    assert.match(inline, /onCancel/);
    assert.doesNotMatch(inline, /setQuantityDraft\(""\).*onSave/);
  });

  test("unresolved quantity issues appear on the affected row; summary jumps to that row", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(ready, /data-builder-quantity-issue-row/);
    assert.match(ready, /Needs quantity/);
    assert.match(estimate, /focusFirstQuantityIssue/);
    assert.match(estimate, /data-builder-quantity-issue-row/);
    assert.doesNotMatch(estimate, /focusFinishEstimate/);
    assert.doesNotMatch(estimate, /highlightFinishEstimate/);
  });

  test("measured quantity is a secondary action, not a second editor", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    const inline = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchInlineQuantityEditor.tsx"
    );
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(inline, /WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL/);
    assert.match(ready, /onClearManualQuantity/);
    assert.match(estimate, /handleClearManualQuantity/);
    assert.match(client, /clearManualQuantityScopeDecision/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchEditOptionShell/);
  });

  test("Finish estimate and Edit scope are not parallel ordinary quantity editors", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.doesNotMatch(estimate, /openEditPackage/);
    assert.doesNotMatch(estimate, /onOpenEditPackage/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchEditOptionShell/);
    assert.doesNotMatch(estimate, /manualQuantityEnabled=\{scopeReviewManualQuantityEnabled\}/);
  });

  test("hide and exclude remain distinct existing persist paths", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(ready, /Hide from customer/);
    assert.match(ready, /WORKBENCH_REMOVE_FROM_OPTION_ACTION/);
    assert.match(client, /hideLineFromCustomer/);
    assert.match(client, /excludeLineFromProposalOption/);
    assert.match(client, /clearExcludedLine/);
    assert.match(client, /clearCustomerVisibilityHide/);
  });

  test("restore excluded remains in Removed scope, not mixed into active rows", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /data-builder-removed-from-proposal/);
    assert.match(estimate, /handleRestoreExcludedLine/);
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.doesNotMatch(ready, /handleRestoreExcludedLine/);
  });

  test("V2B1 shell and protected writes stay in place", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(header, /data-builder-command-bar/);
    assert.match(actions, /BUILDER_CUSTOMER_REVIEW_LABEL/);
    assert.match(client, /updateDraftSelectedOption/);
    assert.match(client, /handleRefreshDraftPricing/);
    assert.match(client, /buildProposalCustomerPreviewHref/);
    assert.match(client, /ProposalBuilderCustomerRequestBanner/);
    assert.doesNotMatch(actions, /Send proposal/);
  });
});
