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

  test("6. Edit scope opens contractor package drawer", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /openEditPackage/);
    assert.match(estimate, /editPackageOpen/);

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
    assert.match(estimate, /onFocusTemplateItemId=\{setFocusedTemplateItemId\}/);
    assert.match(estimate, /focusedTemplateItemId=\{focusedTemplateItemId\}/);
    // Drawer stays open independently of focused row.
    assert.match(estimate, /editPackageOpen/);
    assert.match(estimate, /closeEditPackage/);
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

  test("18. Package cards wrap; balanced columns for 3–4 packages", () => {
    const cards = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageCards.tsx"
    );
    assert.match(cards, /data-builder-package-cards/);
    assert.match(cards, /packageChoiceGridClass/);
    assert.doesNotMatch(cards, /min-\[1180px\]:grid-cols-3/);

    const flow = read(
      "app/tools/roofing/templates/templatesWorkspaceFlow.ts"
    );
    assert.match(flow, /xl:grid-cols-4/);
    assert.match(flow, /md:grid-cols-3/);
    assert.match(flow, /sm:grid-cols-2/);

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

  test("22. Package cards: Current / Available; Choose package; summary card", () => {
    const cards = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageCards.tsx"
    );
    assert.match(cards, /Current/);
    assert.match(cards, /Available/);
    assert.doesNotMatch(cards, /Included/);
    assert.doesNotMatch(cards, /customer-facing options/);
    assert.match(cards, /packageChoiceGridClass/);

    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.doesNotMatch(selector, /Choose starting package/);
    assert.doesNotMatch(selector, /customer-facing package/);
    assert.match(selector, /forceOpen|onPickerOpenChange/);
    assert.match(selector, /Change package/);

    const pkg = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(pkg, /data-builder-package-summary/);
    assert.match(pkg, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.doesNotMatch(pkg, /Edit Enhanced package/);
    assert.match(pkg, /packageZone\.bullets\.map/);
    assert.match(pkg, /Selected package/);
    assert.match(pkg, /Current/);
    assert.match(pkg, /Choose package/);
    assert.match(pkg, /WORKBENCH_EDIT_PACKAGE_TITLE/);
    assert.match(pkg, /data-builder-package-done/);
    assert.match(pkg, /data-builder-edit-package/);
    assert.doesNotMatch(pkg, /Choose starting package/);
  });

  test("23. Removed from proposal copy; Restore; no Package scope decisions", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /data-builder-removed-from-proposal/);
    assert.match(estimate, /Removed from proposal/);
    assert.match(estimate, /line hidden from this package|lines hidden from this package/);
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
    assert.match(sectionNav, /border-blue-600 bg-blue-50\/45/);
    assert.match(sectionNav, /rounded-t-lg border-b-2/);
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
    assert.match(ready, /itemCellOnly/);
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
    assert.match(ready, /manualQuantityActive && onEditQuantityForLine/);
    assert.match(ready, /data-builder-edit-quantity/);
    assert.match(ready, /Edit qty/);
    assert.match(ready, /group-hover\/estimate-row:opacity-100/);
    assert.match(ready, /group-focus-within\/estimate-row:opacity-100/);
  });

  test("27. Block 4G — Finish estimate full-width far-right Set quantity", () => {
    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.match(attention, /WORKBENCH_FINISH_ESTIMATE_ROW/);
    assert.match(attention, /data-builder-finish-estimate/);
    assert.match(attention, /WORKBENCH_SET_QUANTITY_ACTION/);
    assert.doesNotMatch(attention, /max-w-\[40rem\]/);
    assert.doesNotMatch(attention, /flex flex-wrap items-center justify-between/);

    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /WORKBENCH_FINISH_ESTIMATE_ROW/);
    assert.match(constants, /minmax\(0,1fr\)_auto/);
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
    assert.match(pkg, /Choose package/);
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
