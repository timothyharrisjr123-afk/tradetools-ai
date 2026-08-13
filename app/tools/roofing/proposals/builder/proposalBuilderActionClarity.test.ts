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

  test("5. Review quantities focuses the first unresolved estimate row", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /focusFirstQuantityIssue/);
    assert.match(estimate, /data-builder-quantity-issue-row/);
    assert.doesNotMatch(estimate, /focusFinishEstimate/);
    const reviewIdx = estimate.indexOf("data-builder-review-quantities");
    const reviewBlock = estimate.slice(Math.max(0, reviewIdx - 220), reviewIdx + 80);
    assert.match(reviewBlock, /focusFirstQuantityIssue/);
    assert.doesNotMatch(reviewBlock, /openEditPackage|openSetQuantity/);
  });

  test("6. Edit scope is demoted from the primary Estimate surface", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.doesNotMatch(estimate, /openEditPackage/);
    assert.doesNotMatch(estimate, /editPackageOpen/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchEditOptionShell/);

    const shell = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEditOptionShell.tsx"
    );
    assert.match(shell, /data-builder-edit-package-drawer/);
    assert.match(shell, /Contractor-only changes for this proposal draft/);
    assert.match(shell, /Quantity review/);
    assert.match(shell, /Future package tools/);
    assert.match(shell, /data-builder-future-package-tools/);
    assert.match(shell, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.match(shell, /WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL/);
    assert.match(shell, /data-builder-quantity-review-line/);
    assert.match(shell, /data-selected=\{isActive/);
    assert.match(shell, /data-builder-quantity-review-toggle/);
    assert.match(shell, /isActive \? null : line\.templateItemId/);
    assert.match(shell, /aria-expanded=\{isActive\}/);
    assert.match(shell, /Collapse \$\{line\.name\}/);
    assert.match(shell, /Expand \$\{line\.name\}/);
    assert.match(shell, /data-builder-selected-quantity-editor/);
    assert.match(shell, /Current custom quantity/);
    assert.match(shell, /Change custom quantity/);
    assert.match(shell, /Save quantity/);
    assert.match(shell, /for \$\{activeManualLine\.name\}/);
    assert.match(
      shell,
      /onClearManualQuantity\(activeManualLine\.templateItemId\)/
    );
    assert.match(
      shell,
      /onFocusTemplateItemId: \(templateItemId: string \| null\) => void/
    );
    assert.doesNotMatch(shell, /Advanced package settings/);
    assert.doesNotMatch(shell, /scope decision layer/i);
    assert.doesNotMatch(shell, /pricing stays trustworthy/i);
    assert.doesNotMatch(shell, /Edit \$\{optionLabel/);
    assert.doesNotMatch(shell, /Package scope/i);
    // Future tools stay collapsed — not large disabled primary sections.
    assert.doesNotMatch(shell, /WORKBENCH_EDIT_OPTION_SECTION/);
    assert.doesNotMatch(shell, /Browse catalog/);
    const footer = shell.slice(shell.indexOf("<footer"));
    assert.doesNotMatch(footer, /WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL|handleClear/);
    assert.match(footer, /Saved changes apply immediately/);
    assert.match(footer, />\s*Done\s*</);

    // Accordion: measured quantity only inside open selected row editor.
    const editorIdx = shell.indexOf("data-builder-selected-quantity-editor");
    assert.ok(editorIdx > 0);
    const editorBlock = shell.slice(editorIdx, editorIdx + 4200);
    assert.match(editorBlock, /WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL/);
    assert.match(editorBlock, /Save quantity/);
  });

  test("6b. Quantity review accordion opens, switches, and collapses", () => {
    const shell = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEditOptionShell.tsx"
    );
    assert.match(shell, /isActive \? null : line\.templateItemId/);
    assert.match(shell, /data-builder-quantity-review-toggle/);
    assert.match(shell, /aria-expanded=\{isActive\}/);
    // Collapsing clears focus without closing the drawer (drawer close is separate).
    assert.match(shell, /onFocusTemplateItemId:\s*\(templateItemId: string \| null\)/);
    const toggleIdx = shell.indexOf("data-builder-quantity-review-toggle");
    assert.ok(toggleIdx > 0);
    const toggleBlock = shell.slice(Math.max(0, toggleIdx - 280), toggleIdx + 120);
    assert.match(toggleBlock, /isActive \? null : line\.templateItemId/);
    assert.doesNotMatch(toggleBlock, /onClose\(/);

    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.doesNotMatch(estimate, /onFocusTemplateItemId=\{setFocusedTemplateItemId\}/);
    assert.doesNotMatch(estimate, /editPackageOpen/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchEditOptionShell/);
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

  test("11–12. Optional upgrades use additive selection chrome", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /ProposalBuilderWorkbenchUpgradesZone/);

    const presenter = read("app/lib/proposalBuilderWorkbenchEstimatePresenter.ts");
    assert.match(presenter, /show: hasTemplateUpgradeSections/);

    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    assert.match(upgrades, /Add to proposal/);
    assert.match(upgrades, /Remove/);
    assert.match(upgrades, /Replaces .* when selected/);
    assert.doesNotMatch(upgrades, /Replace base/);

    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const selectionHandler = client.slice(
      client.indexOf("const handleSetUpgradeSelected"),
      client.indexOf("const showStaleBanner")
    );
    assert.match(selectionHandler, /upsertUpgradeChoiceSelection/);
    assert.match(selectionHandler, /refreshDraftPricing/);
    assert.match(selectionHandler, /setPersistedGraph\(graph\)/);
  });

  test("13. Hide from customer is a row overflow action distinct from exclude", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /Hide from customer/);
    assert.match(ready, /Show to customer/);
    assert.match(ready, /onHideFromCustomer/);
    assert.match(ready, /WORKBENCH_REMOVE_FROM_OPTION_ACTION/);
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /handleHideLine/);
    assert.match(estimate, /handleRestoreVisibility/);
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
    assert.match(ready, /canEditQty = Boolean\(onEditQuantityForLine\)/);
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

  test("18. Builder package chooser is a compact list, not a card grid", () => {
    const list = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageChoiceList.tsx"
    );
    assert.match(list, /data-builder-package-choice-list/);
    assert.match(list, /role="radiogroup"/);
    assert.doesNotMatch(list, /packageChoiceGridClass/);
    assert.doesNotMatch(list, /\bCURRENT\b/);
    assert.doesNotMatch(list, /\bAVAILABLE\b/);

    const packageZone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(packageZone, /data-builder-edit-package/);
    assert.match(packageZone, /overflow-visible/);
    assert.match(packageZone, /data-builder-package-sheet/);
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
    assert.match(ready, /id: "details"/);
    assert.match(ready, /id: "remove"/);
    assert.match(ready, /Hide from customer/);
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

  test("22. Compact healthy band; Change package opens a decision list", () => {
    const list = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageChoiceList.tsx"
    );
    assert.match(list, /Selected/);
    assert.match(list, /data-builder-package-choice-select/);
    assert.doesNotMatch(list, /\bCurrent\b/);
    assert.doesNotMatch(list, /\bAvailable\b/);
    assert.doesNotMatch(list, /customer-facing options/);

    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.doesNotMatch(selector, /Choose starting package/);
    assert.doesNotMatch(selector, /customer-facing package/);
    assert.match(selector, /forceOpen|onPickerOpenChange/);
    assert.match(selector, /Change package/);
    assert.match(selector, /ProposalBuilderPackageChoiceList/);

    const pkg = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(pkg, /data-builder-package-summary/);
    assert.match(pkg, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.doesNotMatch(pkg, /Edit Enhanced package/);
    assert.match(pkg, /packageZone\.bullets/);
    assert.match(pkg, /highlights\.join/);
    assert.match(pkg, /data-builder-package-selected-summary/);
    assert.match(pkg, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.match(pkg, /data-builder-package-done/);
    assert.match(pkg, /data-builder-edit-package/);
    assert.doesNotMatch(pkg, /Selected package/);
    assert.doesNotMatch(pkg, />Current</);
    assert.doesNotMatch(pkg, /Choose starting package/);
    assert.doesNotMatch(pkg, /Choose package/);
  });

  test("23. Removed from proposal copy; Restore; no Package scope decisions", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /data-builder-removed-from-proposal/);
    assert.match(estimate, /Removed from proposal/);
    assert.match(estimate, /line removed from this package|lines removed from this package/);
    assert.match(estimate, /data-builder-estimate-surface/);
    assert.match(estimate, /decisionTraceZone\.show/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchSettingsEntry/);
    assert.doesNotMatch(estimate, /Package scope decisions/i);
    assert.doesNotMatch(estimate, /include in this option again/i);

    const trace = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchDecisionTraceZone.tsx"
    );
    assert.doesNotMatch(trace, /Package scope decisions/i);
    assert.doesNotMatch(trace, /package for this job/i);
    assert.doesNotMatch(trace, /Include in this option again/i);
    assert.match(trace, /WORKBENCH_RESTORE_EXCLUDED_ACTION/);
    assert.match(trace, /data-builder-restore-removed/);

    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /WORKBENCH_RESTORE_EXCLUDED_ACTION = "Restore"/);

    const presenter = read("app/lib/proposalBuilderWorkbenchEstimatePresenter.ts");
    assert.match(presenter, /WORKBENCH_DECISION_TRACE_REMOVED_TITLE = "Removed from proposal"/);
    assert.match(presenter, /Items removed from this proposal\./);
    assert.doesNotMatch(presenter, /package for this job/i);
  });

  test("24. Top section navigation is integrated, not a boxed tray", () => {
    const sectionNav = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderSectionNav.tsx"
    );
    assert.match(sectionNav, /data-builder-section-bar="top"/);
    assert.match(sectionNav, /border-b-2/);
    assert.match(sectionNav, /border-blue-600 font-semibold/);
    assert.match(sectionNav, /role="tablist"/);
    assert.match(sectionNav, /data-builder-page-switcher-compact/);
    assert.doesNotMatch(sectionNav, /rounded-xl border border-slate-200\/80 bg-slate-50/);
    assert.doesNotMatch(sectionNav, /ring-1 ring-slate-200/);
    assert.doesNotMatch(sectionNav, />Active</);
    assert.doesNotMatch(sectionNav, /builderPageStripStatusChip/);
  });

  test("25. Block 4G — full-width shared Included Item / Qty / Price grid", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /data-builder-itemized-estimate/);
    assert.match(ready, /WORKBENCH_INCLUDED_ROW_GRID/);
    assert.match(ready, /data-builder-estimate-column-headers/);
    assert.match(ready, /data-builder-qty-edit-trigger/);
    assert.doesNotMatch(ready, /max-w-\[46rem\]/);
    assert.doesNotMatch(ready, /max-w-\[40rem\]/);
    assert.doesNotMatch(ready, /flex items-start gap-1/);

    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /minmax\(0,1fr\)_6rem_8\.5rem_6rem/);
    const includedSlice = constants.slice(
      constants.indexOf("WORKBENCH_INCLUDED_ROW_GRID"),
      constants.indexOf("WORKBENCH_INCLUDED_ROW_GRID") + 280
    );
    assert.doesNotMatch(includedSlice, /max-w-\[/);
  });

  test("26. Block 4G — Edit qty in actions column; no Manual qty badge", () => {
    const lineRow = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchLineRow.tsx"
    );
    assert.match(lineRow, /WORKBENCH_EDIT_QUANTITY_LINK/);
    assert.match(lineRow, /data-builder-edit-quantity/);
    assert.doesNotMatch(lineRow, /Manual qty|WORKBENCH_MANUAL_QTY/);
    assert.doesNotMatch(
      lineRow,
      /Not editable|Quantity locked|System calculated|From measurement|Source locked/
    );

    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /canEditQty = Boolean\(onEditQuantityForLine\)/);
    assert.match(ready, /data-builder-edit-quantity/);
    assert.match(ready, /data-builder-qty-edit-trigger/);
    assert.doesNotMatch(ready, /group-hover\/estimate-row:opacity-100/);
  });

  test("27. Finish estimate is not the canonical quantity editor", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.doesNotMatch(estimate, /manualQuantityEnabled=\{scopeReviewManualQuantityEnabled\}/);
    assert.doesNotMatch(estimate, /highlightFinishEstimate/);
    assert.match(estimate, /data-builder-qty-edit-trigger|focusFirstQuantityIssue/);

    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /data-builder-quantity-issue-row/);
  });

  test("28. Block 4G — inline editor shared grid; no side drawer", () => {
    const inline = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchInlineQuantityEditor.tsx"
    );
    assert.match(inline, /WORKBENCH_INCLUDED_ROW_GRID/);
    assert.match(inline, /alignToColumns/);
    assert.match(inline, /event\.key === "Enter"/);
    assert.match(inline, /Escape/);
    assert.doesNotMatch(inline, /createPortal/);
    assert.doesNotMatch(inline, /SetQuantityPanel/);

    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchSettingsEntry/);
    assert.match(estimate, /ProposalBuilderWorkbenchUpgradesZone/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchSetQuantityPanel/);
  });

  test("29. Continuity correction — totals attach to estimate surface", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const surfaceIdx = estimate.indexOf('data-builder-estimate-surface');
    const readyIdx = estimate.indexOf("<ProposalBuilderWorkbenchReadyScopeZone");
    const totalsIdx = estimate.indexOf("<ProposalBuilderWorkbenchTotalsZone");
    const removedIdx = estimate.indexOf("data-builder-removed-from-proposal");
    const attentionIdx = estimate.indexOf("<ProposalBuilderWorkbenchAttentionZone");
    assert.ok(surfaceIdx > 0);
    assert.ok(readyIdx > surfaceIdx && totalsIdx > readyIdx);
    assert.ok(removedIdx > totalsIdx);
    assert.ok(attentionIdx > removedIdx);

    const totals = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchTotalsZone.tsx"
    );
    assert.match(totals, /data-builder-estimate-totals/);
    assert.match(totals, /pricing footer for the included estimate/i);

    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /WORKBENCH_TOTALS_HEADER = "sr-only"/);
    assert.match(constants, /Totals attach to the estimate frame/);
  });

  test("30. Continuity correction — Change package vs Edit scope labels", () => {
    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /WORKBENCH_EDIT_PACKAGE_TITLE = "Edit scope"/);
    assert.match(constants, /WORKBENCH_CHANGE_PACKAGE_HINT/);
    assert.match(constants, /WORKBENCH_EDIT_SCOPE_HINT/);

    const pkg = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(pkg, /Change package/);
    assert.match(pkg, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.match(pkg, /data-builder-edit-package/);
    assert.doesNotMatch(pkg, /Advanced package settings/);

    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(selector, /Change package/);
    assert.match(selector, /Switch between available packages/);
  });
});
