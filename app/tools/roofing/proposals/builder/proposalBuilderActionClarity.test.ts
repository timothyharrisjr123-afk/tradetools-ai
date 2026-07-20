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
    assert.match(shell, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.doesNotMatch(shell, /Edit \$\{optionLabel/);
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

  test("11–12. Optional upgrades hidden from main Builder path; follow-up documented", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchUpgradesZone/);
    assert.doesNotMatch(estimate, /later proposal editing pass/i);
    assert.doesNotMatch(estimate, /Add to proposal/);
    assert.doesNotMatch(estimate, /Replace base/);
    assert.match(estimate, /additive upgrades add to included estimate/i);
    assert.match(estimate, /replacement upgrades replace base items/i);

    const presenter = read("app/lib/proposalBuilderWorkbenchEstimatePresenter.ts");
    assert.match(presenter, /show: false/);
    assert.match(presenter, /include\/replace unsupported/i);
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

  test("16. Clean contractor rows — edit actions only when editable; no locked labels", () => {
    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.doesNotMatch(attention, /WORKBENCH_FUTURE_ACTION_CHIP/);
    assert.doesNotMatch(attention, /aria-disabled/);
    assert.match(attention, /WORKBENCH_SET_QUANTITY_ACTION|Set quantity/);
    assert.doesNotMatch(attention, /data-builder-edit-package/);
    assert.doesNotMatch(attention, /WORKBENCH_EDIT_PACKAGE_TITLE/);

    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /manualQuantityActive && onEditQuantityForLine/);
    assert.doesNotMatch(ready, /Not editable|Quantity locked|System calculated|From measurement|Source locked/);

    const lineRow = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchLineRow.tsx"
    );
    assert.doesNotMatch(lineRow, /Not editable|Quantity locked|System calculated|From measurement|Source locked/);
  });

  test("17. Inline editor designed; Escape/Enter; no side panel", () => {
    const inline = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchInlineQuantityEditor.tsx"
    );
    assert.match(inline, /data-builder-inline-quantity-editor/);
    assert.match(inline, /event\.key === "Enter"/);
    assert.match(inline, /event\.key !== "Escape"|Escape/);
    assert.match(inline, /preventDefault/);
    assert.match(inline, /alignToColumns/);
    assert.match(inline, /data-builder-inline-quantity-unit/);
    assert.doesNotMatch(inline, /createPortal/);
    assert.doesNotMatch(inline, /SetQuantityPanel/);
  });

  test("18. Package cards wrap; no viewport-1180 three-col clip", () => {
    const cards = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageCards.tsx"
    );
    assert.match(cards, /data-builder-package-cards/);
    assert.match(cards, /sm:grid-cols-2/);
    assert.match(cards, /xl:grid-cols-3/);
    assert.doesNotMatch(cards, /min-\[1180px\]:grid-cols-3/);

    const packageZone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(packageZone, /data-builder-edit-package/);
    assert.match(packageZone, /overflow-visible/);
  });

  test("19. Row menu portal close behavior; View details then Remove", () => {
    const menu = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchRowMenu.tsx"
    );
    assert.match(menu, /createPortal/);
    assert.match(menu, /Escape/);
    assert.match(menu, /mousedown/);
    assert.match(menu, /onOpenMenuIdChange\(null\)/);

    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    const detailsIdx = ready.indexOf('id: "details"');
    const removeIdx = ready.indexOf('id: "remove"');
    assert.ok(detailsIdx > 0 && removeIdx > detailsIdx, "View details before Remove");
    assert.doesNotMatch(ready, /Hide from customer/i);
  });

  test("20. More menu quiet — no locked Send/Sign/Payment clutter", () => {
    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    assert.match(actions, /data-builder-preview-action/);
    assert.match(actions, /Saved pricing details/);
    assert.doesNotMatch(actions, /futureLocks\.map/);
    assert.doesNotMatch(actions, /lock\.label/);
  });

  test("21. Contractor unit labels stay linear ft / each / SQ", () => {
    const presenter = read(
      "app/lib/proposalBuilderWorkbenchEstimatePresenter.ts"
    );
    assert.match(presenter, /formatContractorEstimateQtyLabel/);
    assert.match(presenter, /linear ft/);
    assert.match(presenter, /"each"/);
    assert.match(presenter, /"SQ"/);
  });

  test("22. Package cards: Current / Available; no INCLUDED; Choose package", () => {
    const cards = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageCards.tsx"
    );
    assert.match(cards, /Current/);
    assert.match(cards, /Available/);
    assert.doesNotMatch(cards, /Included/);
    assert.doesNotMatch(cards, /customer-facing options/);

    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(selector, /Choose package/);
    assert.doesNotMatch(selector, /customer-facing package/);

    const pkg = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(pkg, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.doesNotMatch(pkg, /Edit \$\{|Edit \$\{packageZone/);
    assert.doesNotMatch(pkg, /Edit Enhanced package/);
    assert.match(pkg, /bullets\.join\(" · "\)/);
  });

  test("23. Removed from proposal only when lines exist; Display settings off main path", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /data-builder-removed-from-proposal/);
    assert.match(estimate, /Removed from proposal/);
    assert.match(estimate, /decisionTraceZone\.show/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchSettingsEntry/);

    const presenter = read("app/lib/proposalBuilderWorkbenchEstimatePresenter.ts");
    assert.match(presenter, /WORKBENCH_DECISION_TRACE_REMOVED_TITLE = "Removed from proposal"/);
  });

  test("24. Top section bar polished container + active underline", () => {
    const sectionNav = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderSectionNav.tsx"
    );
    assert.match(sectionNav, /data-builder-section-bar="top"/);
    assert.match(sectionNav, /from-slate-50/);
    assert.match(sectionNav, /after:bg-blue-600/);
    assert.doesNotMatch(sectionNav, />Active</);
    assert.doesNotMatch(sectionNav, /builderPageStripStatusChip/);
  });
});
