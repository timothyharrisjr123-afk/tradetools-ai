/**
 * Block 4 — Builder estimate review simplification / handoff presentation.
 * Source + copy contracts only. No math/snapshot/lifecycle mutations.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Builder estimate handoff (Block 4)", () => {
  test("1. Builder route does not highlight Proposal templates", () => {
    const appPage = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderAppPage.tsx"
    );
    assert.match(appPage, /activeNav="jobs"/);
    assert.doesNotMatch(appPage, /activeNav="templates"/);

    const jobCard = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(jobCard, /activeNav=\{entryMode === "job-card" \? "jobs" : "newJob"\}/);

    const templates = read("app/tools/roofing/templates/TemplatesAppPage.tsx");
    assert.match(templates, /activeNav="templates"/);
  });

  test("2. Builder header shows job identity, proposal title, selected package", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.match(header, /data-builder-job-primary-identity/);
    assert.match(header, /data-builder-job-secondary-identity/);
    assert.match(header, /data-builder-handoff-meta/);
    assert.match(header, /proposalTitle/);
    assert.match(header, /selectedPackageLabel/);
    assert.match(header, /data-builder-draft-status/);
    assert.match(header, /\bDraft\b/);
    assert.doesNotMatch(header, /Draft • Saved/);

    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.match(client, /proposalTitle=\{/);
    assert.match(client, /selectedPackageLabel=\{/);
  });

  test("3. Next step uses contractor-facing quantity language", () => {
    const guidance = read("app/lib/proposalBuilderGuidance.ts");
    assert.match(guidance, /title: "Next step"/);
    assert.match(guidance, /need quantities before totals are final/);
    assert.match(guidance, /ctaLabel: "Review items"/);
    assert.doesNotMatch(guidance, /Resolve pricing blockers/);
  });

  test("4. Helper rail is Proposal assistant; Details collapsed by default", () => {
    const rail = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderSummaryRail.tsx"
    );
    assert.match(rail, /Proposal assistant/);
    assert.match(rail, /data-builder-proposal-assistant/);
    assert.match(rail, /title="Details"/);
    assert.match(rail, /defaultOpen=\{false\}/);
    assert.match(rail, /data-builder-rail-details/);
    assert.doesNotMatch(rail, /Proposal helper/);
    // Pricing readiness table must not be always-visible chrome
    assert.doesNotMatch(
      rail,
      /Pricing readiness stays visible/
    );
  });

  test("5. Hide from customer does not render in estimate review path", () => {
    const files = [
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchLineRow.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEditOptionShell.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx",
    ];
    for (const file of files) {
      const src = read(file);
      assert.doesNotMatch(src, /Hide from customer/i, file);
      assert.doesNotMatch(src, /Hidden from customer/i, file);
    }
  });

  test("6. Signing / customer package note absent from package section", () => {
    const pkg = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(pkg, /data-builder-package-helper/);
    assert.match(pkg, /startingPackageHelper/);
    assert.doesNotMatch(pkg, /signing/i);
    assert.doesNotMatch(pkg, /customerSigningHint/);

    const presenter = read("app/lib/proposalBuilderWorkbenchEstimatePresenter.ts");
    assert.match(presenter, /Starting package for this proposal/);
    assert.match(presenter, /customerSigningHint: null/);
  });

  test("7. Remove from option replaced; Set quantity remains primary", () => {
    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /Remove from proposal/);
    assert.doesNotMatch(constants, /Remove from option"/);

    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.match(attention, /WORKBENCH_EDIT_OPTION_CHIP_ENABLED/);
    assert.match(attention, /WORKBENCH_EDIT_OPTION_CHIP_SECONDARY/);
    assert.match(attention, /data-builder-set-quantity/);
    assert.doesNotMatch(attention, /Remove from option/);
  });

  test("8. Quantity review is compact list/rows", () => {
    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.match(attention, /data-builder-quantity-review/);
    assert.match(attention, /data-builder-quantity-review-list/);
    assert.match(attention, /data-builder-quantity-review-row/);
    assert.match(attention, /Needs quantity review/);
    assert.doesNotMatch(attention, /WORKBENCH_SCOPE_REVIEW_ITEM_INDEX/);
  });

  test("9. Included estimate is visual anchor copy", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /Included estimate/);
    assert.match(ready, /Roof replacement scope/);
    assert.match(ready, /data-builder-included-estimate/);
    assert.doesNotMatch(ready, /Customer-ready scope/);
    assert.doesNotMatch(ready, /onHideFromCustomer/);
  });

  test("10. Optional upgrades do not mention signing / customer selection", () => {
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    assert.match(upgrades, /Optional upgrades/);
    assert.match(upgrades, /reviewed before previewing/);
    assert.doesNotMatch(upgrades, /signing/i);
    assert.doesNotMatch(upgrades, /Future customer selections/);
  });

  test("11. Totals copy is contractor-facing", () => {
    const totals = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchTotalsZone.tsx"
    );
    assert.match(totals, /Totals pending review|Totals ready/);
    assert.doesNotMatch(totals, /Totals \/ readiness/);
  });

  test("12. Guardrail blocked is not normal first-viewport language", () => {
    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /Needs review/);
    assert.doesNotMatch(
      constants,
      /return "Blocked"/
    );
    const rail = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderSummaryRail.tsx"
    );
    assert.doesNotMatch(rail, /Guardrail blocked/i);
  });

  test("13. Builder package picker draft-option scoping preserved", () => {
    const picker = read(
      "app/tools/roofing/proposals/builder/proposalBuilderPackageSelector.test.ts"
    );
    assert.match(picker, /draftScoped|draft-option|selected_option_id/i);
  });
});
