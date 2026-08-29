/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesWorkspaceFlow.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  TEMPLATES_EDIT_TABS,
  TEMPLATES_STARTER_PURPOSE_COPY,
  TEMPLATES_WORKSPACE_TRUST_NOTE,
  buildProposalContentLandingAreas,
  buildTemplateCreatesSummary,
  defaultExpandedPackageOptionId,
  formatCustomerDisplaySummary,
  formatActivePackageChoiceGuide,
  formatActivePackageSetupSummary,
  formatPackageScopeCountLine,
  formatTemplateScopeCountLine,
  packageChoiceGridClass,
  resolvePackagePresentation,
  resolvePackageChoiceDescription,
  customerLabelDiffersFromPackageName,
  resolveTemplatePurposeDescription,
  summarizePackageOptionsForWorkspace,
  type PackageOptionSummary,
} from "./templatesWorkspaceFlow";

function packageSummary(
  partial: Partial<PackageOptionSummary> &
    Pick<PackageOptionSummary, "optionId" | "optionLabel">
): PackageOptionSummary {
  return {
    sectionCount: 1,
    catalogSectionCount: 1,
    linkedItemCount: 0,
    issueCount: 0,
    availableUpgradeCount: 0,
    availableUpgradeIssueCount: 0,
    status: "ready",
    ...partial,
  };
}

describe("templatesWorkspaceFlow", () => {
  test("edit tabs are packages / estimate — advanced only", () => {
    assert.deepEqual(
      TEMPLATES_EDIT_TABS.map((t) => t.id),
      ["packages", "estimate"]
    );
    assert.match(TEMPLATES_WORKSPACE_TRUST_NOTE, /Catalog controls item pricing/i);
    assert.match(TEMPLATES_WORKSPACE_TRUST_NOTE, /frozen prices/i);
  });

  test("formatCustomerDisplaySummary describes estimate toggles", () => {
    assert.match(
      formatCustomerDisplaySummary({
        show_line_prices: true,
        show_option_totals: true,
        show_section_headings: true,
      }),
      /line prices.*package totals.*section headings/i
    );
  });

  test("buildTemplateCreatesSummary lists packages and customer areas", () => {
    const graph = {
      template: {
        id: "t1",
        name: "Roof replacement",
        metadata: {},
      },
      options: [],
      sections: [
        { id: "s1", kind: "line_items", option_id: "o1" },
        { id: "s2", kind: "terms", option_id: "o1" },
        { id: "s3", kind: "warranty", option_id: "o1" },
      ],
      items: [],
    } as never;

    const summary = buildTemplateCreatesSummary({
      graph,
      packageSummaries: [
        packageSummary({
          optionId: "o1",
          optionLabel: "Standard",
          sectionCount: 3,
          linkedItemCount: 4,
          availableUpgradeCount: 1,
        }),
        packageSummary({
          optionId: "o2",
          optionLabel: "Premium",
          sectionCount: 2,
          linkedItemCount: 2,
          issueCount: 1,
          status: "needs_attention",
          availableUpgradeCount: 1,
        }),
      ],
      editableProseCount: 2,
    });

    assert.deepEqual(summary.packageLabels, ["Standard", "Premium"]);
    assert.equal(summary.linkedCatalogCount, 6);
    assert.equal(summary.issueCount, 1);
    assert.equal(summary.availableUpgradeCount, 2);
    assert.ok(summary.customerFacingAreas.includes("Estimate packages"));
    assert.ok(summary.customerFacingAreas.includes("Terms"));
    assert.ok(summary.customerFacingAreas.includes("Warranty"));
    assert.equal(summary.editableProseCount, 2);
    assert.match(summary.customerDisplayLine, /Customer estimate shows/i);
  });

  test("defaultExpandedPackageOptionId prefers needs_attention", () => {
    assert.equal(
      defaultExpandedPackageOptionId([
        packageSummary({
          optionId: "a",
          optionLabel: "A",
          linkedItemCount: 2,
        }),
        packageSummary({
          optionId: "b",
          optionLabel: "B",
          linkedItemCount: 1,
          issueCount: 1,
          status: "needs_attention",
        }),
      ]),
      "b"
    );
  });

  test("summarizePackageOptionsForWorkspace excludes upgrade_group from included counts", () => {
    const graph = {
      template: { id: "t1", name: "Starter" },
      options: [],
      sections: [],
      items: [
        {
          id: "i1",
          section_id: "s1",
          option_id: "o1",
          catalog_item_id: "c1",
          sort_order: 10,
        },
        {
          id: "i2",
          section_id: "s1",
          option_id: "o1",
          catalog_item_id: null,
          sort_order: 20,
        },
        {
          id: "i3",
          section_id: "s-upgrade",
          option_id: "o1",
          catalog_item_id: "c-upgrade",
          sort_order: 30,
        },
      ],
    } as never;

    const structureViewModel = {
      templateName: "Starter",
      optionGroups: [
        {
          optionId: "o1",
          optionLabel: "Enhanced",
          sections: [
            {
              sectionId: "s1",
              optionId: "o1",
              kind: "line_items",
              name: "Line items",
              displayTitle: "Line items",
              itemCount: 2,
              sortOrder: 10,
              isReorderable: true,
              isRemovable: false,
              protectionReason: null,
            },
            {
              sectionId: "s-upgrade",
              optionId: "o1",
              kind: "upgrade_group",
              name: "Optional upgrades",
              displayTitle: "Optional upgrades",
              itemCount: 1,
              sortOrder: 20,
              isReorderable: true,
              isRemovable: false,
              protectionReason: null,
            },
          ],
          addableKinds: [],
        },
      ],
    } as never;

    const catalogItems = [
      {
        id: "c1",
        name: "Shingles",
        active: true,
        company_id: "co",
      },
      {
        id: "c-upgrade",
        name: "Additional roof ventilation",
        active: true,
        company_id: "co",
      },
    ] as never;

    const rows = summarizePackageOptionsForWorkspace(
      graph,
      structureViewModel,
      catalogItems
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].linkedItemCount, 1);
    assert.equal(rows[0].issueCount, 1);
    assert.equal(rows[0].availableUpgradeCount, 1);
    assert.equal(rows[0].availableUpgradeIssueCount, 0);
    assert.equal(rows[0].status, "needs_attention");
    assert.equal(
      formatPackageScopeCountLine(rows[0]),
      "2 included · 1 optional upgrade"
    );
  });

  test("package and hero count lines keep upgrades separate from included", () => {
    const enhanced = packageSummary({
      optionId: "enhanced",
      optionLabel: "Enhanced",
      linkedItemCount: 13,
      availableUpgradeCount: 1,
    });
    assert.equal(formatPackageScopeCountLine(enhanced), "13 included · 1 optional upgrade");
    assert.equal(
      formatPackageScopeCountLine(
        packageSummary({
          optionId: "standard",
          optionLabel: "Standard",
          linkedItemCount: 13,
        })
      ),
      "13 included"
    );
    assert.equal(
      formatTemplateScopeCountLine({
        packageCount: 3,
        packageMode: "multi",
        linkedCatalogCount: 39,
        issueCount: 0,
        availableUpgradeCount: 2,
      }),
      "3 packages · 39 included · 2 optional upgrades"
    );
    assert.equal(
      formatTemplateScopeCountLine({
        packageCount: 4,
        packageMode: "multi",
        linkedCatalogCount: 52,
        issueCount: 0,
        availableUpgradeCount: 3,
      }),
      "4 packages · 52 included · 3 optional upgrades"
    );
    assert.equal(formatActivePackageSetupSummary(4), "4 packages");
    assert.equal(formatActivePackageChoiceGuide(4), "Choose from 4 package options.");
    assert.equal(formatActivePackageChoiceGuide(3), "Choose from 3 package options.");
    assert.equal(formatActivePackageChoiceGuide(2), "Choose between 2 package options.");
    assert.match(packageChoiceGridClass(4), /xl:grid-cols-4/);
    assert.match(packageChoiceGridClass(3), /md:grid-cols-3/);
    assert.doesNotMatch(packageChoiceGridClass(4), /md:grid-cols-3/);
  });

  test("resolveTemplatePurposeDescription replaces stale starter install copy", () => {
    assert.equal(
      resolveTemplatePurposeDescription({
        description:
          "Starter roof replacement template with Standard, Enhanced, and Premium customer-facing options. Install catalog items before use.",
      }),
      TEMPLATES_STARTER_PURPOSE_COPY
    );
    assert.equal(
      resolveTemplatePurposeDescription({
        description: "Company custom roofing proposal setup.",
      }),
      "Company custom roofing proposal setup."
    );
  });

  test("resolvePackagePresentation hides simple estimate option container", () => {
    const simple = resolvePackagePresentation({
      graph: {
        template: { id: "t", name: "Simple", metadata: { package_model: "simple" } },
        options: [
          {
            id: "o1",
            name: "Estimate",
            selection_mode: "included",
          },
        ],
        sections: [],
        items: [],
      } as never,
      packageSummaries: [
        packageSummary({
          optionId: "o1",
          optionLabel: "Estimate",
          linkedItemCount: 3,
        }),
      ],
    });
    assert.equal(simple.mode, "simple");
    assert.equal(simple.hidePackageSwitcher, true);
    assert.match(simple.summaryLine, /no package choices/i);
  });

  test("buildProposalContentLandingAreas lists contractor-facing pages", () => {
    const areas = buildProposalContentLandingAreas({
      template: { id: "t", name: "Roof" },
      options: [],
      sections: [
        {
          id: "s1",
          kind: "text",
          name: "Project overview",
          customer_title: "Project overview",
          sort_order: 10,
        },
        {
          id: "s2",
          kind: "line_items",
          name: "Roof replacement scope",
          sort_order: 20,
        },
        {
          id: "s3",
          kind: "warranty",
          name: "Warranty",
          sort_order: 30,
        },
        {
          id: "s4",
          kind: "terms",
          name: "Terms",
          sort_order: 40,
        },
      ],
      items: [],
    } as never);
    assert.ok(areas.some((row) => row.label === "Project overview"));
    assert.ok(areas.some((row) => row.label === "Estimate"));
    assert.ok(areas.some((row) => row.label === "Warranty and protection"));
    assert.ok(areas.some((row) => row.label === "Terms / next steps"));
  });

  test("package choice description uses authored copy only", () => {
    assert.equal(
      resolvePackageChoiceDescription({
        optionLabel: "Standard",
        optionDescription: "Authored Standard story.",
      }),
      "Authored Standard story."
    );
    assert.equal(
      resolvePackageChoiceDescription({ optionLabel: "Standard", optionDescription: "  " }),
      null
    );
    assert.equal(
      resolvePackageChoiceDescription({ optionLabel: "Custom Choice", optionDescription: null }),
      null
    );
  });

  test("customer label differs from package name only when distinct", () => {
    assert.equal(customerLabelDiffersFromPackageName("Standard", "Standard"), false);
    assert.equal(customerLabelDiffersFromPackageName("Standard", "Good"), true);
    assert.equal(customerLabelDiffersFromPackageName("Standard", "  "), false);
  });
});
