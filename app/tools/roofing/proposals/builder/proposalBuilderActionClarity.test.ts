/**
 * Block 4D / 4E — Builder action clarity + inline editing contracts.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderActionClarity.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Builder action clarity (Block 4D / 4E)", () => {
  test("1–2. Set quantity is inline editor, not side panel", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchSetQuantityPanel/);
    assert.match(estimate, /ProposalBuilderWorkbenchInlineQuantityEditor|onStartSetQuantity|editingQuantityLineId/);

    assert.equal(
      existsSync(
        path.join(
          root,
          "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchSetQuantityPanel.tsx"
        )
      ),
      false,
      "side panel file must be removed"
    );

    const inline = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchInlineQuantityEditor.tsx"
    );
    assert.match(inline, /data-builder-inline-quantity-editor/);
    assert.match(inline, /validateManualQuantityInput/);
    assert.doesNotMatch(inline, /createPortal/);
    assert.doesNotMatch(inline, /WORKBENCH_EDIT_OPTION_DRAWER/);

    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.match(attention, /ProposalBuilderWorkbenchInlineQuantityEditor/);
    assert.match(attention, /data-builder-set-quantity/);
  });

  test("3. Inline quantity save uses existing manual quantity handler", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /onSaveQuantity=\{\s*quantityEditingEnabled \? handleApplyManualQuantity/);
  });

  test("5. Review quantities focuses Finish estimate; no drawer/panel", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /focusFinishEstimate/);
    assert.match(estimate, /setHighlightFinishEstimate/);
    assert.match(estimate, /builder-finish-estimate-first-row/);
    const reviewIdx = estimate.indexOf("data-builder-review-quantities");
    const reviewBlock = estimate.slice(Math.max(0, reviewIdx - 220), reviewIdx + 80);
    assert.match(reviewBlock, /focusFinishEstimate/);
    assert.doesNotMatch(reviewBlock, /openEditPackage|openSetQuantity/);
  });

  test("6. Edit package opens advanced drawer", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /openEditPackage/);
    assert.match(estimate, /editPackageOpen/);

    const shell = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEditOptionShell.tsx"
    );
    assert.match(shell, /data-builder-edit-package-drawer/);
    assert.match(shell, /Advanced package settings for this proposal/);
    assert.doesNotMatch(shell, /Package scope/i);
  });

  test("7–10. Row menu portal polish; Remove uses exclude path", () => {
    const menu = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchRowMenu.tsx"
    );
    assert.match(menu, /createPortal/);
    assert.match(menu, /data-builder-row-menu-portal/);
    assert.match(menu, /Escape/);
    assert.match(menu, /mousedown/);
    assert.match(menu, /onOpenMenuIdChange\(null\)/);

    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /ProposalBuilderWorkbenchRowMenu/);
    assert.match(ready, /openMenuId/);

    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /onRemoveFromProposal=\{excludeEnabled \? handleExcludeLine/);
  });

  test("11–12. Optional upgrades collapsed; no fake include/replace", () => {
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    assert.match(upgrades, /data-builder-optional-upgrades-collapsed/);
    assert.match(upgrades, /data-builder-upgrade-selection-follow-up/);
    assert.match(upgrades, /Upgrade selection follow-up needed/);
    assert.doesNotMatch(upgrades, /Add to proposal/);
    assert.doesNotMatch(upgrades, /Replace base/);
    assert.doesNotMatch(upgrades, /signing/i);
    assert.doesNotMatch(upgrades, /customer selection/i);
  });

  test("13. No Hide from customer on estimate action path", () => {
    const files = [
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchInlineQuantityEditor.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchRowMenu.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx",
    ];
    for (const file of files) {
      assert.doesNotMatch(read(file), /Hide from customer/i, file);
    }
  });

  test("14. Compact success feedback aligned to Builder stage", () => {
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(client, /Quantity saved\. Pricing refreshed\./);
    assert.match(client, /data-builder-refresh-feedback/);
    assert.match(client, /BUILDER_STAGE/);
  });

  test("15. Package picker draft scoping still present", () => {
    const picker = read(
      "app/tools/roofing/proposals/builder/proposalBuilderPackageSelector.test.ts"
    );
    assert.match(picker, /draftScoped|selected_option_id/i);
  });
});
