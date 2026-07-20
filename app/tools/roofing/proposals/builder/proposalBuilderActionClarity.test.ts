/**
 * Block 4D — Builder action clarity contracts.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderActionClarity.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Builder action clarity (Block 4D)", () => {
  test("1. Review quantities does not open full package drawer", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /data-builder-review-quantities/);
    assert.match(estimate, /onClick=\{focusFinishEstimate\}/);
    assert.doesNotMatch(
      estimate,
      /data-builder-review-quantities[\s\S]{0,80}openEditPackage/
    );
    // Review button must not call openEditPackage.
    const reviewIdx = estimate.indexOf("data-builder-review-quantities");
    const reviewBlock = estimate.slice(Math.max(0, reviewIdx - 200), reviewIdx + 80);
    assert.match(reviewBlock, /focusFinishEstimate/);
    assert.doesNotMatch(reviewBlock, /openEditPackage/);
  });

  test("2. Review quantities focuses Finish estimate section", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /focusFinishEstimate/);
    assert.match(estimate, /builder-finish-estimate/);
    assert.match(estimate, /scrollIntoView/);

    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.match(attention, /id="builder-finish-estimate"/);
    assert.match(attention, /data-builder-finish-estimate/);
  });

  test("3–5. Set quantity opens item-level panel using manual quantity path", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /openSetQuantityForLine/);
    assert.match(estimate, /ProposalBuilderWorkbenchSetQuantityPanel/);
    assert.match(estimate, /onSave=\{handleApplyManualQuantity\}/);

    const panel = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchSetQuantityPanel.tsx"
    );
    assert.match(panel, /data-builder-set-quantity-panel/);
    assert.match(panel, /Set quantity/);
    assert.match(panel, /applyManualQuantity|onSave/);
    assert.match(panel, /validateManualQuantityInput/);
    assert.doesNotMatch(panel, /pickerLines|Editable scope lines|Package scope/i);
    assert.doesNotMatch(panel, /scopeReviewLines\.map/);
  });

  test("6–8. Edit package opens advanced drawer; copy is Edit package", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /openEditPackage/);
    assert.match(estimate, /editPackageOpen/);
    assert.match(estimate, /ProposalBuilderWorkbenchEditOptionShell/);

    const shell = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEditOptionShell.tsx"
    );
    assert.match(shell, /data-builder-edit-package-drawer/);
    assert.match(shell, /Edit \$\{optionLabel\.trim\(\)\} package/);
    assert.doesNotMatch(shell, /Package scope/i);
    assert.doesNotMatch(shell, />Edit option</);

    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.match(attention, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.match(attention, /data-builder-edit-package/);
    assert.doesNotMatch(attention, />Edit option</);

    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /WORKBENCH_EDIT_PACKAGE_TITLE = "Edit package"/);
  });

  test("9–10. Included estimate quiet More menu; Remove uses exclude path", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /data-builder-included-row-menu/);
    assert.match(ready, /data-builder-remove-from-proposal/);
    assert.match(ready, /onRemoveFromProposal/);
    assert.match(ready, /View details/);

    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /onRemoveFromProposal=\{excludeEnabled \? handleExcludeLine/);
    assert.match(estimate, /removeEnabled=\{excludeEnabled\}/);
  });

  test("11–12. Optional upgrades collapsed by default; no signing language", () => {
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    assert.match(upgrades, /data-builder-optional-upgrades-collapsed/);
    assert.match(upgrades, /<details/);
    assert.doesNotMatch(upgrades, /signing/i);
    assert.doesNotMatch(upgrades, /customerSelectionHint/);
    assert.doesNotMatch(upgrades, /customer selection/i);
  });

  test("13. No Hide from customer on estimate action path", () => {
    const files = [
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchSetQuantityPanel.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx",
    ];
    for (const file of files) {
      assert.doesNotMatch(read(file), /Hide from customer/i, file);
    }
  });

  test("14. Package picker draft scoping still present", () => {
    const picker = read(
      "app/tools/roofing/proposals/builder/proposalBuilderPackageSelector.test.ts"
    );
    assert.match(picker, /draftScoped|selected_option_id/i);
  });
});
