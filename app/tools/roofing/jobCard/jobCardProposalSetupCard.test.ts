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
  test("1–2. RoofingClient Proposals tab mounts compact setup card", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /JobCardProposalSetupCard/);
    assert.doesNotMatch(
      client,
      /tabId="proposals"[\s\S]{0,800}WorkspaceHeading>Proposal status/
    );
  });

  test("3. Create proposal copy explains draft from job/template/Catalog", () => {
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalSetup.ts");
    assert.match(helpers, /JOB_CARD_CREATE_PROPOSAL_EXPLAINER/);
    assert.match(helpers, /measurements/);
    assert.match(helpers, /Catalog pricing/);
    assert.match(helpers, /Proposal Builder/);
  });

  test("4–8. Setup card has Measurement → Template → Package → Included → Create order", () => {
    const card = read("app/tools/roofing/jobCard/JobCardProposalSetupCard.tsx");
    assert.match(card, /data-jobcard-setup-step=\{step\}/);
    assert.match(card, /SetupRow step=\{1\} label="Measurement"/);
    assert.match(card, /SetupRow step=\{2\} label="Template"/);
    assert.match(card, /SetupRow step=\{3\} label="Package"/);
    assert.match(card, /SetupRow step=\{4\} label="Included summary"/);
    assert.match(card, /SetupRow step=\{5\} label="Create \/ open proposal"/);
    assert.match(card, /data-jobcard-package-selector/);
    assert.match(card, /data-jobcard-included-summary/);
    assert.match(card, /data-jobcard-review-included/);
    assert.match(card, /data-jobcard-create-explainer/);
    assert.match(card, /Create proposal draft/);
    assert.match(card, /Open proposal draft/);
  });

  test("9. Happy path does not force Review templates link when ready", () => {
    const links = read("app/tools/roofing/jobCard/JobCardProposalsSetupLinks.tsx");
    assert.match(links, /quietWhenReady/);
    assert.match(links, /return null/);
    assert.doesNotMatch(links, /Review templates/);
  });

  test("10. Fix template/catalog use return-to-job setup hrefs", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /buildSetupRouteHref\(\s*"\/tools\/roofing\/templates"/);
    assert.match(client, /buildSetupRouteHref\(\s*"\/tools\/roofing\/catalog"/);
    assert.match(client, /returnLabel:\s*jobCardReturnLabel/);
  });

  test("11–12. Create/open uses durable draft entry path", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /resolveOrCreateProposalDraftEntry/);
    assert.match(client, /createDraftProposal/);
    assert.match(client, /selected_template_option_id/);
    assert.match(client, /buildProposalBuilderHref\(currentJobId/);
  });

  test("13–14. Builder back link lands on Job Card proposals", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.match(header, /Back to Job Card/);
    assert.match(header, /tab:\s*"proposals"/);
  });

  test("15. Templates/Catalog return label supports job name", () => {
    const templates = read("app/tools/roofing/templates/TemplatesAppPage.tsx");
    const catalog = read("app/tools/roofing/catalog/CatalogAppPage.tsx");
    assert.match(templates, /formatReturnToJobProposalsLabel/);
    assert.match(catalog, /formatReturnToJobProposalsLabel/);
    assert.match(templates, /returnLabel/);
    assert.match(catalog, /returnLabel/);
  });
});
