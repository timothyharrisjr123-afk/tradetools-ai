/**
 * R1: after create, package count/copy must follow active packages — not create-time model.
 * Run: npx tsx --test app/tools/roofing/templates/templatesActivePackageCount.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatActivePackageChoiceGuide,
  formatActivePackageSetupSummary,
  formatTemplateScopeCountLine,
  packageChoiceGridClass,
  resolvePackagePresentation,
} from "./templatesWorkspaceFlow";
import {
  resolveCreateProposalPackageStepEyebrow,
  resolveCreateProposalPackageStepGuide,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";

const ROOT = join(process.cwd(), "app/tools/roofing");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("R1 active package count truth", () => {
  test("count helpers stay truthful for 1–5 packages", () => {
    assert.equal(formatActivePackageSetupSummary(1), "1 package");
    assert.equal(formatActivePackageSetupSummary(3), "3 packages");
    assert.equal(formatActivePackageSetupSummary(4), "4 packages");
    assert.equal(formatActivePackageChoiceGuide(4), "Choose from 4 package options.");
    assert.equal(
      formatTemplateScopeCountLine({
        packageCount: 4,
        packageMode: "multi",
        linkedCatalogCount: 40,
        issueCount: 0,
        availableUpgradeCount: 0,
      }),
      "4 packages · 40 included"
    );
  });

  test("presentation summaryLine for multi uses live count", () => {
    const multi = resolvePackagePresentation({
      graph: {
        template: { id: "t", name: "Auth", metadata: { package_model: "triple" } },
        options: [
          { id: "a", name: "Good", removed_at: null },
          { id: "b", name: "Better", removed_at: null },
          { id: "c", name: "Best", removed_at: null },
          { id: "d", name: "Best Plus", removed_at: null },
        ],
        sections: [],
        items: [],
      } as never,
      packageSummaries: [
        { optionId: "a", optionLabel: "Good" },
        { optionId: "b", optionLabel: "Better" },
        { optionId: "c", optionLabel: "Best" },
        { optionId: "d", optionLabel: "Best Plus" },
      ].map((row) => ({
        ...row,
        sectionCount: 1,
        catalogSectionCount: 1,
        linkedItemCount: 10,
        issueCount: 0,
        availableUpgradeCount: 0,
        availableUpgradeIssueCount: 0,
        isDefault: row.optionId === "d",
        status: "ready" as const,
      })),
    });
    assert.equal(multi.mode, "multi");
    assert.match(multi.summaryLine, /4 packages/i);
    assert.doesNotMatch(multi.summaryLine, /three packages|3 packages|separate template/i);
  });

  test("Job Card guide uses live count for 4 packages", () => {
    assert.match(
      resolveCreateProposalPackageStepEyebrow("multi", 4),
      /4 packages/i
    );
    assert.match(
      resolveCreateProposalPackageStepGuide("multi", 4),
      /Choose from 4 package options/i
    );
    assert.doesNotMatch(
      resolveCreateProposalPackageStepGuide("multi", 4),
      /Choose from 3 package options/i
    );
  });

  test("Templates + Job Card use shared adaptive grid helper", () => {
    const review = read("templates/TemplatesQuoteSetupReview.tsx");
    const modal = read("jobCard/JobCardCreateProposalModal.tsx");
    const builderList = read("proposals/builder/ProposalBuilderPackageChoiceList.tsx");
    assert.ok(review.includes("packageChoiceGridClass"));
    assert.ok(review.includes("formatActivePackageSetupSummary"));
    assert.ok(modal.includes("packageChoices.length"));
    assert.ok(modal.includes("data-jobcard-prepare-selector"));
    assert.equal(builderList.includes("packageChoiceGridClass"), false);
    assert.match(packageChoiceGridClass(4), /xl:grid-cols-4/);
    assert.doesNotMatch(packageChoiceGridClass(4), /md:grid-cols-3/);
  });

  test("create-time Three packages copy stays only in guided create planner", () => {
    const planner = read("templates/templatesGuidedCreatePlanner.ts");
    const review = read("templates/TemplatesQuoteSetupReview.tsx");
    const modal = read("jobCard/JobCardCreateProposalModal.tsx");
    assert.ok(planner.includes("Three packages"));
    assert.equal(review.includes("Three packages"), false);
    assert.equal(modal.includes("Three packages"), false);
    assert.equal(modal.includes("Good / Better / Best"), false);
  });
});
