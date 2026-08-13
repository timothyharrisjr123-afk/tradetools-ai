/**
 * V2B3 — compact job-specific package picker.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderPackagePickerV2b3.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("V2B3 compact package picker", () => {
  test("chooser is a compact decision list without gallery cards or badges", () => {
    const list = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageChoiceList.tsx"
    );
    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(list, /data-builder-package-choice-list/);
    assert.match(list, /role="radiogroup"/);
    assert.match(list, /role="radio"/);
    assert.match(list, /aria-checked=\{selected\}/);
    assert.match(list, /data-builder-package-choice-selected-label/);
    assert.match(list, /data-builder-package-choice-select/);
    assert.doesNotMatch(list, /\bCURRENT\b|\bCurrent\b/);
    assert.doesNotMatch(list, /\bAVAILABLE\b|\bAvailable\b/);
    assert.doesNotMatch(list, /Crown|Sparkles|Shield/);
    assert.doesNotMatch(list, /packageChoiceGridClass/);
    assert.match(selector, /ProposalBuilderPackageChoiceList/);
    assert.doesNotMatch(selector, /ProposalBuilderPackageCards/);
  });

  test("one-package state hides Change package and does not add helper copy", () => {
    const zone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(zone, /canChangeBuilderDraftPackage/);
    assert.match(zone, /allowChangePackage && !pickerOpen/);
    assert.doesNotMatch(zone, /This proposal has one package/);
    assert.doesNotMatch(zone, /Only one package available/);
    assert.match(selector, /allowChangePackage \? \(/);
  });

  test("selection uses existing handler once and closes on choose; cancel writes nothing", () => {
    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const zone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(selector, /onSelectOption\(optionId\)/);
    assert.match(selector, /setShowAll\(false\)/);
    assert.match(client, /updateDraftSelectedOption/);
    assert.match(client, /if \(nextTemplateOptionId === previousTemplateOptionId\) return/);
    assert.match(client, /if \(optionPersistInFlightRef\.current\) return/);
    assert.match(client, /setSelectedOptionId\(previousTemplateOptionId\)/);
    assert.match(zone, /data-builder-package-done/);
    assert.match(zone, /closePicker/);
    assert.doesNotMatch(zone, /updateDraftSelectedOption/);
  });

  test("selected total is existing authoritative truth only; other packages omit price", () => {
    const list = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageChoiceList.tsx"
    );
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(list, /selectedPackageTotalLabel/);
    assert.match(list, /selected && selectedTotal/);
    assert.match(list, /data-builder-package-choice-total/);
    assert.doesNotMatch(list, /customerTotalCents/);
    assert.doesNotMatch(list, /buildProposalBuilderPricingPreview/);
    assert.match(estimate, /presentation\.totalsZone\.showAmounts/);
    assert.match(estimate, /presentation\.totalsZone\.totalLabel/);
  });

  test("390px uses a compact sheet; desktop stays an inline list", () => {
    const zone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    const list = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageChoiceList.tsx"
    );
    assert.match(zone, /data-builder-package-sheet/);
    assert.match(zone, /data-builder-package-sheet-backdrop/);
    assert.match(zone, /sm:hidden/);
    assert.match(zone, /sm:static/);
    assert.match(zone, /Escape/);
    assert.match(zone, /data-builder-change-package/);
    assert.match(list, /min-h-\[44px\]/);
  });

  test("V2B1 shell and V2B2 row editing remain in place", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(header, /data-builder-command-bar/);
    assert.match(ready, /data-builder-qty-edit-trigger/);
    assert.match(ready, /data-builder-quantity-issue-row/);
    assert.match(estimate, /focusFirstQuantityIssue/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchEditOptionShell/);
    assert.match(estimate, /ProposalBuilderWorkbenchUpgradesZone/);
  });
});
