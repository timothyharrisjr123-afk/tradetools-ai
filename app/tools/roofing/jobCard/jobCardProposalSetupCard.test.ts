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
    assert.doesNotMatch(
      proposalsPanel,
      /Open proposal draft[\s\S]{0,80}onClick=\{handleLaunchProposalDraft\}/
    );
  });

  test("3. Create explainer + premium headline copy", () => {
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalSetup.ts");
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(helpers, /Creates a draft from this job/);
    assert.match(card, /Ready to create proposal/);
    assert.match(card, /data-jobcard-setup-headline/);
    assert.match(card, /Create proposal draft/);
    assert.match(card, /Open proposal draft/);
  });

  test("4–8. Setup order Measurement → Template → Package → Included → CTA", () => {
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(card, /step=\{1\}[\s\S]*label="Measurement"/);
    assert.match(card, /step=\{2\}[\s\S]*label="Template"/);
    assert.match(card, /step=\{3\}[\s\S]*label="Package"/);
    assert.match(card, /step=\{4\}[\s\S]*label="Included items"/);
    assert.match(card, /data-jobcard-package-selector/);
    assert.match(card, /data-jobcard-included-summary/);
    assert.match(card, /data-jobcard-review-included/);
  });

  test("9. Happy path does not force Review templates", () => {
    const links = read("app/tools/roofing/jobCard/JobCardProposalsSetupLinks.tsx");
    assert.match(links, /quietWhenReady/);
    assert.doesNotMatch(links, /Review templates/);
  });

  test("10–12. Durable draft path + selected package option + listed draft Open label", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /resolveOrCreateProposalDraftEntry/);
    assert.match(client, /selected_template_option_id/);
    assert.match(client, /buildProposalBuilderHref\(currentJobId/);
    assert.match(client, /listedJobDraftProposalId/);
    assert.match(client, /listProposalsForJob/);
  });

  test("13–14. Builder draft handoff waives false template gate; back link to proposals", () => {
    const builder = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    const readiness = read("app/lib/proposalBuilderReadiness.ts");
    assert.match(builder, /hasValidPersistedDraft/);
    assert.match(readiness, /hasValidPersistedDraft/);
    assert.match(header, /tab:\s*"proposals"/);
    assert.match(header, /Back to Job Card/);
  });

  test("15. Templates/Catalog return label supports job name", () => {
    const templates = read("app/tools/roofing/templates/TemplatesAppPage.tsx");
    const catalog = read("app/tools/roofing/catalog/CatalogAppPage.tsx");
    assert.match(templates, /formatReturnToJobProposalsLabel/);
    assert.match(catalog, /formatReturnToJobProposalsLabel/);
  });
});
