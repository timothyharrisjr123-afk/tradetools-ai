/**
 * V2B4 — optional upgrades presentation + upgrade quantity ownership.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderOptionalUpgradesV2b4.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("V2B4 optional upgrades + quantity ownership", () => {
  test("available and selected upgrades render as flat rows with semantic selection", () => {
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    assert.match(upgrades, /data-builder-optional-upgrades/);
    assert.match(upgrades, /data-builder-upgrade-row/);
    assert.match(upgrades, /data-builder-upgrade-selected/);
    assert.match(upgrades, /selectedCountLabel\(zone\.selectedCount\)/);
    assert.match(upgrades, /type="checkbox"/);
    assert.match(upgrades, /checked=\{selected\}/);
    assert.doesNotMatch(upgrades, /rounded-2xl|shadow-lg/);
    assert.doesNotMatch(upgrades, /AVAILABLE|CURRENT/);
    assert.doesNotMatch(upgrades, /<details/);
    assert.doesNotMatch(upgrades, /useEffect\(/);
  });

  test("selection calls existing persist once; duplicate submit blocked; no optimistic write", () => {
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(upgrades, /onSetUpgradeSelected/);
    assert.match(upgrades, /disabled=\{selectionInFlight\}/);
    assert.match(upgrades, /!selected/);
    const selectionHandler = client.slice(
      client.indexOf("const handleSetUpgradeSelected"),
      client.indexOf("const showStaleBanner")
    );
    assert.match(selectionHandler, /upsertUpgradeChoiceSelection/);
    assert.match(selectionHandler, /selected \? "selected" : "not_selected"/);
    assert.match(selectionHandler, /refreshDraftPricing/);
    assert.match(selectionHandler, /upgradeSelectionInFlightRef\.current/);
    assert.match(selectionHandler, /setUpgradeSelectionError/);
    assert.doesNotMatch(selectionHandler, /setPersistedGraph\(.*selected/);
  });

  test("upgrade quantity editing is canonical on the affected upgrade", () => {
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(upgrades, /data-builder-upgrade-qty-edit-trigger/);
    assert.match(upgrades, /ProposalBuilderWorkbenchInlineQuantityEditor/);
    assert.match(upgrades, /WORKBENCH_SET_QUANTITY_ACTION|Set quantity/);
    assert.match(upgrades, /WORKBENCH_EDIT_QUANTITY_ACTION|Edit quantity/);
    assert.match(upgrades, /canEditQuantity/);
    assert.match(estimate, /onSaveQuantity=\{quantityEditingEnabled \? handleApplyManualQuantity/);
    assert.match(estimate, /onClearManualQuantity=/);
    assert.match(client, /applyManualQuantityScopeDecision/);
    assert.match(client, /clearManualQuantityScopeDecision/);
    assert.doesNotMatch(upgrades, /openEditPackage|Finish estimate/);
  });

  test("unresolved upgrade quantity is owned by the exact upgrade row", () => {
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    assert.match(upgrades, /data-builder-upgrade-quantity-issue/);
    assert.match(upgrades, /data-builder-upgrade-needs-quantity/);
    assert.match(upgrades, /Needs quantity/);
    assert.match(upgrades, /Qty \{quantityIssue \? "Not resolved" : line\.qtyLabel\}/);
    assert.match(upgrades, /isAuthoritativePrice/);
    assert.doesNotMatch(upgrades, /data-builder-quantity-issue-row/);
  });

  test("estimate and upgrade review summaries are separate destinations", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /focusFirstQuantityIssue/);
    assert.match(estimate, /focusFirstUpgradeQuantityIssue/);
    assert.match(estimate, /data-builder-estimate-quantity-review/);
    assert.match(estimate, /data-builder-upgrade-quantity-review/);
    assert.match(estimate, /data-builder-review-quantities/);
    assert.match(estimate, /data-builder-review-upgrades/);
    assert.match(estimate, /estimate quantities need review/);
    assert.match(estimate, /upgrade quantities need review/);
    assert.match(estimate, /Review estimate/);
    assert.match(estimate, /Review upgrades/);

    const estimateReview = estimate.slice(
      estimate.indexOf("data-builder-review-quantities") - 220,
      estimate.indexOf("data-builder-review-quantities") + 80
    );
    assert.match(estimateReview, /focusFirstQuantityIssue/);
    assert.doesNotMatch(estimateReview, /focusFirstUpgradeQuantityIssue/);

    const upgradeReview = estimate.slice(
      estimate.indexOf("data-builder-review-upgrades") - 280,
      estimate.indexOf("data-builder-review-upgrades") + 80
    );
    assert.match(upgradeReview, /focusFirstUpgradeQuantityIssue/);
    assert.doesNotMatch(upgradeReview, /focusFirstQuantityIssue/);

    const upgradeJump = estimate.slice(
      estimate.indexOf("const focusFirstUpgradeQuantityIssue"),
      estimate.indexOf("const openSetQuantityForLine")
    );
    assert.match(upgradeJump, /data-builder-upgrade-quantity-issue/);
    assert.match(upgradeJump, /data-builder-upgrade-qty-edit-trigger/);
    assert.doesNotMatch(upgradeJump, /data-builder-quantity-issue-row/);
    assert.doesNotMatch(upgradeJump, /\[data-builder-qty-edit-trigger\]/);
    assert.doesNotMatch(estimate, /\$\{qtyNeeded\} quantities need review/);
  });

  test("estimate jump still targets estimate rows only", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    const estimateJump = estimate.slice(
      estimate.indexOf("const focusFirstQuantityIssue"),
      estimate.indexOf("const focusFirstUpgradeQuantityIssue")
    );
    assert.match(estimateJump, /data-builder-quantity-issue-row/);
    assert.match(estimateJump, /data-builder-qty-edit-trigger/);
    assert.doesNotMatch(estimateJump, /data-builder-upgrade-quantity-issue/);
    assert.match(ready, /data-builder-quantity-issue-row/);
    assert.match(ready, /data-builder-qty-edit-trigger/);
  });

  test("presenter only counts selected upgrades for upgrade quantity issues", () => {
    const presenter = read("app/lib/proposalBuilderWorkbenchEstimatePresenter.ts");
    assert.match(
      presenter,
      /upgradeMeta\.selectionState === "selected" &&/
    );
    assert.match(presenter, /upgradeScopeReviewLines\.push/);
  });

  test("V2B1–V2B3 and protected persist paths remain untouched", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const packageZone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    assert.match(header, /data-builder-command-bar/);
    assert.match(actions, /BUILDER_CUSTOMER_REVIEW_LABEL/);
    assert.match(packageZone, /ProposalBuilderPackageSelector/);
    assert.match(estimate, /ProposalBuilderWorkbenchPackageZone/);
    const totalsIdx = estimate.indexOf("ProposalBuilderWorkbenchTotalsZone");
    const upgradesIdx = estimate.indexOf("<ProposalBuilderWorkbenchUpgradesZone");
    const removedIdx = estimate.indexOf("data-builder-removed-from-proposal");
    assert.equal(totalsIdx > 0 && upgradesIdx > totalsIdx, true);
    assert.equal(removedIdx > upgradesIdx, true);
    assert.match(client, /updateDraftSelectedOption/);
    assert.match(client, /upsertUpgradeChoiceSelection/);
    assert.match(client, /applyManualQuantityScopeDecision/);
    assert.match(client, /refreshDraftPricing/);
    assert.doesNotMatch(client, /proposalPricingEngine/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchEditOptionShell/);
  });

  test("accessibility: selection, issue text, 44px targets, labeled qty action", () => {
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    assert.match(upgrades, /type="checkbox"/);
    assert.match(upgrades, /aria-label=/);
    assert.match(upgrades, /Selected/);
    assert.match(upgrades, /Not selected/);
    assert.match(upgrades, /Needs quantity/);
    assert.match(upgrades, /min-h-\[44px\]/);
    assert.match(upgrades, /role="alert"/);
    assert.match(upgrades, /\$\{quantityActionLabel\} for \$\{line\.name\}/);
  });
});
