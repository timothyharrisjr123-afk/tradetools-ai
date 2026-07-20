/**
 * Static presence tests for Job Card Proposals tab (Block 2 surface).
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardProposalSetupCard.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Job Card Proposals tab (Block 2)", () => {
  test("1. Header wires blue + Proposal action", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalsTabModel.ts");
    assert.match(client, /JobCardProposalsTab/);
    assert.match(client, /JobCardProposalsAddHeaderButton/);
    assert.match(client, /headerAction=\{/);
    assert.match(helpers, /\+ Proposal/);
    assert.match(helpers, /bg-blue-600/);
    assert.match(tab, /data-jobcard-add-proposal/);
    assert.doesNotMatch(helpers, /bg-black|bg-slate-900/);
  });

  test("2. Empty state copy — no always-open setup card", () => {
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalsTabModel.ts");
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const proposalsPanel = client.slice(
      client.indexOf('tabId="proposals"'),
      client.indexOf('tabId="material_orders"')
    );
    assert.match(helpers, /No proposals yet/);
    assert.match(helpers, /measurement report/i);
    assert.match(tab, /data-jobcard-proposals-empty/);
    assert.doesNotMatch(proposalsPanel, /JobCardProposalSetupCard/);
    assert.doesNotMatch(proposalsPanel, /data-jobcard-create-fields/);
    assert.doesNotMatch(proposalsPanel, /data-jobcard-package-selector/);
  });

  test("3. Smoke-only jobs use empty list path + Block 1 isolation", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /filterContractorVisibleProposals/);
    assert.match(client, /buildJobCardProposalRowViews/);
    assert.match(
      read("app/lib/contractorFixtureIsolation.ts"),
      /coverage basis live smoke/
    );
  });

  test("4. Compact rows + Open — no create-from-row", () => {
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    assert.match(tab, /data-jobcard-proposal-list-row/);
    assert.match(tab, /data-jobcard-proposal-open/);
    assert.match(tab, /JOB_CARD_PROPOSALS_OPEN_LABEL|Open/);
    assert.doesNotMatch(tab, /Create proposal draft/);
    assert.doesNotMatch(tab, /onCreateNewDraft/);
  });

  test("5. + Proposal opens Block 2 placeholder — does not create drafts", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalsTabModel.ts");
    assert.match(client, /setShowJobCardProposalEntry\(true\)/);
    assert.match(tab, /data-jobcard-proposal-entry-placeholder/);
    assert.match(helpers, /measurement → template → package/);
    const proposalsPanel = client.slice(
      client.indexOf('tabId="proposals"'),
      client.indexOf('tabId="material_orders"')
    );
    assert.doesNotMatch(proposalsPanel, /handleCreateNewProposalDraft/);
    assert.doesNotMatch(proposalsPanel, /createNewProposalDraftEntry/);
  });

  test("6. Open uses Builder href with proposal id — not create", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /onOpenProposal/);
    assert.match(client, /buildProposalBuilderHref\(currentJobId, proposalId\)/);
  });

  test("7. Old copy is absent from Proposals panel", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const proposalsPanel = client.slice(
      client.indexOf('tabId="proposals"'),
      client.indexOf('tabId="material_orders"')
    );
    assert.doesNotMatch(proposalsPanel, /Create proposal draft/);
    assert.doesNotMatch(proposalsPanel, /Create another proposal/);
    assert.doesNotMatch(proposalsPanel, /Open saved proposal/);
    assert.doesNotMatch(proposalsPanel, /Draft ready · can create another/);
    assert.doesNotMatch(proposalsPanel, /Current proposal/);
    assert.doesNotMatch(proposalsPanel, /Start proposal/);
    assert.doesNotMatch(proposalsPanel, /Show older drafts/);
    assert.doesNotMatch(proposalsPanel, /Source template/);
  });

  test("8. Builder package picker remains draft-option scoped", () => {
    const builderClient = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(builderClient, /scopeTemplateGraphToDraftPackageOptions/);
    assert.match(selector, /canChangeBuilderDraftPackage/);
    assert.match(selector, /BUILDER_ONLY_ONE_PACKAGE_NOTE/);
  });

  test("9. Primary button is FieldDive blue, not black", () => {
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalsTabModel.ts");
    assert.match(helpers, /JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS/);
    assert.match(helpers, /bg-blue-600/);
    assert.match(helpers, /hover:bg-blue-700/);
    assert.doesNotMatch(
      helpers.slice(
        helpers.indexOf("JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS"),
        helpers.indexOf("JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS")
      ),
      /bg-black|bg-slate-900|bg-neutral-900/
    );
  });

  test("10. Job Card status/activity follow visible proposals (Block 2 follow-up)", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalsTabModel.ts");
    const readiness = read("app/lib/proposalBuilderReadiness.ts");
    assert.match(client, /formatJobCardContractorProposalStatusLabel/);
    assert.match(client, /hasVisibleContractorProposal/);
    assert.match(helpers, /Ready to create proposal/);
    assert.match(helpers, /Ready for proposal/);
    assert.match(readiness, /hasVisibleContractorProposal/);
    assert.match(client, /activeNav=\{entryMode === "job-card" \? "jobs" : "newJob"\}/);
  });
});
