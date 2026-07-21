/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesWorkspaceFlow.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  TEMPLATES_EDIT_TABS,
  TEMPLATES_WORKSPACE_TRUST_NOTE,
  buildProposalContentLandingAreas,
  buildTemplateCreatesSummary,
  defaultExpandedPackageOptionId,
  formatCustomerDisplaySummary,
  resolvePackagePresentation,
  summarizePackageOptionsForWorkspace,
} from "./templatesWorkspaceFlow";

describe("templatesWorkspaceFlow", () => {
  test("edit tabs are packages / estimate / content — advanced only", () => {
    assert.deepEqual(
      TEMPLATES_EDIT_TABS.map((t) => t.id),
      ["packages", "estimate", "content"]
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
        {
          optionId: "o1",
          optionLabel: "Standard",
          sectionCount: 3,
          catalogSectionCount: 1,
          linkedItemCount: 4,
          issueCount: 0,
          status: "ready",
        },
        {
          optionId: "o2",
          optionLabel: "Premium",
          sectionCount: 2,
          catalogSectionCount: 1,
          linkedItemCount: 2,
          issueCount: 1,
          status: "needs_attention",
        },
      ],
      editableProseCount: 2,
    });

    assert.deepEqual(summary.packageLabels, ["Standard", "Premium"]);
    assert.equal(summary.linkedCatalogCount, 6);
    assert.equal(summary.issueCount, 1);
    assert.ok(summary.customerFacingAreas.includes("Estimate packages"));
    assert.ok(summary.customerFacingAreas.includes("Terms"));
    assert.ok(summary.customerFacingAreas.includes("Warranty"));
    assert.equal(summary.editableProseCount, 2);
    assert.match(summary.customerDisplayLine, /Customer estimate shows/i);
  });

  test("defaultExpandedPackageOptionId prefers needs_attention", () => {
    assert.equal(
      defaultExpandedPackageOptionId([
        {
          optionId: "a",
          optionLabel: "A",
          sectionCount: 1,
          catalogSectionCount: 1,
          linkedItemCount: 2,
          issueCount: 0,
          status: "ready",
        },
        {
          optionId: "b",
          optionLabel: "B",
          sectionCount: 1,
          catalogSectionCount: 1,
          linkedItemCount: 1,
          issueCount: 1,
          status: "needs_attention",
        },
      ]),
      "b"
    );
  });

  test("summarizePackageOptionsForWorkspace counts links and issues", () => {
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
      ],
    } as never;

    const structureViewModel = {
      templateName: "Starter",
      optionGroups: [
        {
          optionId: "o1",
          optionLabel: "Standard",
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
    ] as never;

    const rows = summarizePackageOptionsForWorkspace(
      graph,
      structureViewModel,
      catalogItems
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].linkedItemCount, 1);
    assert.equal(rows[0].issueCount, 1);
    assert.equal(rows[0].status, "needs_attention");
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
        {
          optionId: "o1",
          optionLabel: "Estimate",
          sectionCount: 1,
          catalogSectionCount: 1,
          linkedItemCount: 3,
          issueCount: 0,
          status: "ready",
        },
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
    assert.ok(areas.some((row) => row.label === "Overview"));
    assert.ok(areas.some((row) => row.label === "Estimate"));
    assert.ok(areas.some((row) => row.label === "Warranty"));
    assert.ok(areas.some((row) => row.label === "Terms"));
  });
});
