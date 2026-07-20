/**
 * Builder package selector — draft-option truth + one/multi-option UX.
 *
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderPackageSelector.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Builder package selector draft-option truth", () => {
  test("1. Client scopes package picker to draft options", () => {
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(client, /scopeTemplateGraphToDraftPackageOptions/);
    assert.match(client, /packageSelectorGraph=\{packageSelectorGraph\}/);
    assert.match(client, /draftScopedPackagePicker=\{draftScopedPackagePicker\}/);
    assert.match(
      client,
      /Selected option is not available on this proposal draft/
    );
    assert.match(client, /resolveRuntimeOptionIdFromTemplateOptionId/);
    assert.match(client, /updateDraftSelectedOption/);
  });

  test("2. Canvas/EstimateDocument pass draft-scoped picker graph", () => {
    const canvas = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx"
    );
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const zone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(canvas, /packageSelectorGraph/);
    assert.match(canvas, /draftScopedPackagePicker/);
    assert.match(canvas, /optionGraphForSelection/);
    assert.match(estimate, /packageSelectorGraph=\{packageSelectorGraph\}/);
    assert.match(zone, /graph=\{packageSelectorGraph\}/);
    assert.match(zone, /draftScoped=\{draftScopedPackagePicker\}/);
  });

  test("3. One-option drafts hide Change package and show static note", () => {
    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    const helpers = read("app/lib/proposalBuilderDraftPackageOptions.ts");
    assert.match(selector, /canChangeBuilderDraftPackage/);
    assert.match(selector, /BUILDER_ONLY_ONE_PACKAGE_NOTE/);
    assert.match(selector, /data-builder-only-one-package-note/);
    assert.match(selector, /data-builder-change-package/);
    assert.match(selector, /allowChangePackage \? \(/);
    assert.match(helpers, /Only one package exists on this draft/);
  });

  test("4. Multi-option drafts keep Change package control", () => {
    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(selector, /Change package/);
    assert.match(selector, /ProposalBuilderPackageCards/);
    assert.match(selector, /draftScoped/);
  });

  test("5. Live-template-only options cannot be selected on a draft", () => {
    const helpers = read("app/lib/proposalBuilderDraftPackageOptions.ts");
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(helpers, /scopeTemplateGraphToDraftPackageOptions/);
    assert.match(helpers, /isTemplateOptionOnDraft/);
    assert.match(helpers, /Live-only options are dropped/);
    assert.match(client, /resolveRuntimeOptionIdFromTemplateOptionId/);
    assert.match(
      client,
      /Selected option is not available on this proposal draft/
    );
  });

  test("6. Persist path uses draft runtime option id via selected_option_id", () => {
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(client, /updateDraftSelectedOption\(/);
    assert.match(client, /selected_option_id: runtimeOptionId/);
    assert.match(client, /runtimeOptionId/);
  });

  test("7. Preview remains selected-option driven (no package redesign)", () => {
    const preview = read("app/lib/proposalCustomerPreviewViewModel.ts");
    assert.match(preview, /selected_option_id|selectedTemplateOptionId|selectedOption/);
    assert.doesNotMatch(preview, /scopeTemplateGraphToDraftPackageOptions/);
  });

  test("8. Job Card open+create stays honest + compact zones", () => {
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalSetup.ts");
    assert.match(card, /data-jobcard-draft-open-summary/);
    assert.match(card, /data-jobcard-existing-draft-card/);
    assert.match(card, /data-jobcard-create-new-card/);
    assert.match(helpers, /JOB_CARD_CREATE_ANOTHER_EXPLAINER/);
    assert.match(helpers, /JOB_CARD_CURRENT_PROPOSAL_LABEL/);
    assert.match(helpers, /formatContractorProposalTitle/);
    assert.doesNotMatch(card, /Start new draft/);
  });
});
