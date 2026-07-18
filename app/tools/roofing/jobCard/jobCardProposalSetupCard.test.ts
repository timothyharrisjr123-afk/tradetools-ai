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
  test("1. Proposals tab mounts one primary Create/Open CTA in setup card", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(client, /JobCardProposalSetupCard/);
    assert.match(card, /data-jobcard-create-cta/);
    assert.match(card, /data-jobcard-setup-cta-zone/);
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

  test("3. Create vs draft-open modes and vocabulary", () => {
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalSetup.ts");
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(helpers, /Creates a draft from this job/);
    assert.match(helpers, /JOB_CARD_OPEN_PROPOSAL_EXPLAINER/);
    assert.match(card, /Ready to create draft/);
    assert.match(card, /Draft ready to open/);
    assert.match(card, /data-jobcard-setup-mode/);
    assert.match(card, /data-jobcard-draft-open-summary/);
    assert.match(card, /Create proposal draft/);
    assert.match(card, /Open proposal draft/);
  });

  test("4. Existing draft mode hides create template/package selectors", () => {
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(card, /draftMode \? \(/);
    assert.match(card, /data-jobcard-template-select/);
    assert.match(card, /data-jobcard-package-selector/);
    assert.match(card, /showTemplatePicker = !draftMode/);
    assert.match(card, /Source template/);
    assert.match(card, /Package \/ option/);
    assert.doesNotMatch(card, /Start new draft/);
  });

  test("5. Create setup order Measurement → Template → Package → Included → CTA", () => {
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(card, /step=\{1\}[\s\S]*label="Measurement"/);
    assert.match(card, /step=\{2\}[\s\S]*label="Template"/);
    assert.match(card, /step=\{3\}[\s\S]*label="Package"/);
    assert.match(card, /step=\{4\}[\s\S]*label="Included items"/);
  });

  test("6. RoofingClient wires draft-open summary + shared identity", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /draftOpenSummary=\{jobCardDraftOpenSummary\}/);
    assert.match(client, /buildJobCardDraftOpenSummary/);
    assert.match(client, /formatJobCardProposalsTabStatus/);
    assert.match(client, /formatJobIdentityReturnLabel/);
    assert.match(client, /getProposalOptionLabel/);
    assert.match(client, /listedJobDraftSummary/);
  });

  test("7. Happy path does not force Review templates", () => {
    const links = read("app/tools/roofing/jobCard/JobCardProposalsSetupLinks.tsx");
    assert.match(links, /quietWhenReady/);
    assert.doesNotMatch(links, /Review templates/);
  });

  test("8. Durable draft path + selected package option + listed draft Open label", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /resolveOrCreateProposalDraftEntry/);
    assert.match(client, /selected_template_option_id/);
    assert.match(client, /buildProposalBuilderHref\(currentJobId/);
    assert.match(client, /listedJobDraftProposalId/);
    assert.match(client, /listProposalsForJob/);
  });

  test("9. Builder shared identity + back link to proposals", () => {
    const builder = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    const readiness = read("app/lib/proposalBuilderReadiness.ts");
    const identity = read("app/lib/jobIdentityDisplay.ts");
    assert.match(builder, /hasValidPersistedDraft/);
    assert.match(readiness, /hasValidPersistedDraft/);
    assert.match(header, /tab:\s*"proposals"/);
    assert.match(header, /Back to Job Card/);
    assert.match(header, /resolveJobIdentityDisplay/);
    assert.match(header, /data-builder-job-primary-identity/);
    assert.match(identity, /customer_name/);
  });

  test("10. Builder entry hierarchy demotes frozen helper; Preview is next action", () => {
    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    const guidance = read("app/lib/proposalBuilderGuidance.ts");
    assert.match(constants, /BUILDER_SNAPSHOT_FROZEN_HELPER_CLASS/);
    assert.match(constants, /BUILDER_GUARDRAIL_MESSAGE_BLOCK_PREVIEW_OK/);
    assert.match(constants, /Next: use Preview in the header/);
    assert.match(guidance, /open_customer_preview/);
    assert.match(guidance, /Open Preview/);
  });

  test("11. Templates/Catalog return label supports job name", () => {
    const templates = read("app/tools/roofing/templates/TemplatesAppPage.tsx");
    const catalog = read("app/tools/roofing/catalog/CatalogAppPage.tsx");
    assert.match(templates, /formatReturnToJobProposalsLabel/);
    assert.match(catalog, /formatReturnToJobProposalsLabel/);
  });
});
