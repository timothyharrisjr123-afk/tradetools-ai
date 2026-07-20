/**
 * Static presence tests for Job Card Compact Proposal Setup Card.
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

describe("Job Card Compact Proposal Setup Card", () => {
  test("1. Proposals tab mounts Create/Open CTAs in setup card", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(client, /JobCardProposalSetupCard/);
    assert.match(card, /data-jobcard-create-cta/);
    assert.match(card, /data-jobcard-setup-cta-zone/);
    assert.match(card, /data-jobcard-open-cta/);
  });

  test("2. Duplicate header Create Proposal button is removed", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const proposalsPanel = client.slice(
      client.indexOf('tabId="proposals"'),
      client.indexOf('tabId="material_orders"')
    );
    assert.doesNotMatch(proposalsPanel, /headerAction=\{/);
    assert.equal(
      (proposalsPanel.match(/Create proposal draft/g) ?? []).length,
      0,
      "Create label lives in the setup card component, not duplicated in RoofingClient panel"
    );
  });

  test("3. Compact Current proposal + Start proposal vocabulary", () => {
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalSetup.ts");
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(helpers, /JOB_CARD_CURRENT_PROPOSAL_LABEL/);
    assert.match(helpers, /JOB_CARD_CREATE_ANOTHER_HEADLINE/);
    assert.match(helpers, /Start proposal/);
    assert.match(card, /Current proposal|JOB_CARD_CURRENT_PROPOSAL_LABEL/);
    assert.match(card, /open_and_create/);
    assert.match(card, /data-jobcard-draft-open-summary/);
    assert.match(card, /Create proposal draft/);
    assert.match(card, /Open in Builder/);
    assert.match(card, /formatContractorProposalTitle/);
  });

  test("4. Existing draft does not hide create-new selectors", () => {
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(card, /data-jobcard-existing-draft-card/);
    assert.match(card, /data-jobcard-create-new-card/);
    assert.match(card, /data-jobcard-template-select/);
    assert.match(card, /data-jobcard-package-selector/);
    assert.match(card, /JOB_CARD_CREATE_ANOTHER_EXPLAINER/);
    assert.match(
      read("app/tools/roofing/jobCard/jobCardProposalSetup.ts"),
      /Creates a separate draft/
    );
    assert.doesNotMatch(card, /Start new draft/);
    assert.match(card, /CreateProposalFields/);
  });

  test("5. Create setup includes Template, Package, Included", () => {
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(card, /label="Template"|label:\s*"Template"/);
    assert.match(card, /Package/);
    assert.match(card, /Included/);
    assert.match(card, /data-jobcard-package-selector/);
    assert.match(card, /data-jobcard-included-summary/);
  });

  test("6. RoofingClient wires open + force-create + collapsed older drafts", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /draftOpenSummary=\{jobCardDraftOpenSummary\}/);
    assert.match(client, /createNewProposalDraftEntry/);
    assert.match(client, /onCreateNewDraft=\{handleCreateNewProposalDraft\}/);
    assert.match(client, /onCreateOrOpen=\{handleLaunchProposalDraft\}/);
    assert.match(client, /listedJobDraftSummaries/);
    assert.match(client, /showOlderJobDrafts/);
    assert.match(client, /data-jobcard-older-drafts-toggle/);
    assert.match(client, /JOB_CARD_SHOW_OLDER_DRAFTS_LABEL/);
    assert.match(client, /data-jobcard-proposal-list-row/);
  });

  test("7. Happy path does not force Review templates", () => {
    const links = read("app/tools/roofing/jobCard/JobCardProposalsSetupLinks.tsx");
    assert.match(links, /quietWhenReady/);
    assert.doesNotMatch(links, /Review templates/);
  });

  test("8. Durable draft path + selected package option preserved", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /createNewProposalDraftEntry/);
    assert.match(client, /resolveOrCreateProposalDraftEntry/);
    assert.match(client, /selected_template_option_id/);
    assert.match(client, /buildProposalBuilderHref\(currentJobId/);
    assert.match(client, /listProposalsForJob/);
  });

  test("9. Builder shared identity + back link to proposals", () => {
    const builder = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.match(builder, /hasValidPersistedDraft/);
    assert.match(header, /Back to Job Card/);
    assert.match(header, /resolveJobIdentityDisplay/);
  });

  test("10. Builder package picker remains draft-option scoped", () => {
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(client, /scopeTemplateGraphToDraftPackageOptions/);
    assert.match(selector, /canChangeBuilderDraftPackage/);
    assert.match(selector, /BUILDER_ONLY_ONE_PACKAGE_NOTE/);
  });

  test("11. Current proposal card stays compact — no source-template field stack", () => {
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.doesNotMatch(card, /Source template/);
    assert.doesNotMatch(card, /JOB_CARD_EXISTING_DRAFT_INTERNAL_NOTE/);
    assert.doesNotMatch(card, /JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE/);
    assert.match(card, /formatContractorProposalTitle/);
  });

  test("12. Block 1 wires contractor fixture isolation on Job Card lists/pickers", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /filterContractorVisibleProposals/);
    assert.match(client, /filterContractorVisibleTemplates/);
    assert.match(client, /pickContractorVisibleJobDraft/);
    assert.match(
      read("app/lib/contractorFixtureIsolation.ts"),
      /coverage basis live smoke/
    );
    assert.match(
      read("app/lib/contractorFixtureIsolation.ts"),
      /raw_plus_waste/
    );
  });
});
