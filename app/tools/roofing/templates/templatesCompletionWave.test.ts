/**
 * Combined Templates completion wave (V2E3 + V2E4 + V2E5) contracts.
 * Run: npx tsx --test app/tools/roofing/templates/templatesCompletionWave.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  DEFAULT_PACKET_OVERVIEW_BODY,
  DEFAULT_PACKET_SCOPE_NOTES_BODY,
  DEFAULT_PACKET_TERMS_BODY,
  DEFAULT_PACKET_WARRANTY_BODY,
} from "@/app/lib/proposalCustomerPacketDefaultContent";
import { DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS } from "@/app/lib/defaultRoofingProposalTemplates";
import { PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL } from "@/app/lib/proposalCustomerPacketViewModel";
import { GUIDED_PACKAGE_MODEL_CHOICES } from "./templatesGuidedCreatePlanner";
import {
  formatPackageScopeCountLine,
  TEMPLATES_ADD_OPTIONAL_UPGRADE_ACTION,
  TEMPLATES_AVAILABLE_UPGRADES_HEADING,
  TEMPLATES_INCLUDED_WORK_HEADING,
} from "./templatesWorkspaceFlow";

const ROOT = join(process.cwd(), "app");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Templates completion wave", () => {
  test("V2E3: Preview facts have no Package highlights heading", () => {
    const strip = read("tools/roofing/proposals/preview/ProposalCustomerPreviewPackageStrip.tsx");
    assert.doesNotMatch(strip, /Package highlights/);
    assert.match(strip, /Selected package/);
  });

  test("V2E3: starter package descriptions remain optional prefilled copy", () => {
    const option = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0]?.options?.[0];
    assert.ok((option?.description ?? "").length > 0);
    const editors = read("tools/roofing/templates/TemplatesSetupAuthorshipEditors.tsx");
    assert.match(editors, /Short customer description/);
    assert.doesNotMatch(editors, /required.*description/i);
  });

  test("V2E4: included and optional stay separate in counts and headings", () => {
    assert.equal(TEMPLATES_INCLUDED_WORK_HEADING, "Included work");
    assert.equal(TEMPLATES_AVAILABLE_UPGRADES_HEADING, "Optional upgrades");
    assert.equal(TEMPLATES_ADD_OPTIONAL_UPGRADE_ACTION, "Add optional upgrade");
    assert.equal(
      formatPackageScopeCountLine({
        optionId: "a",
        optionLabel: "Standard",
        sectionCount: 1,
        catalogSectionCount: 1,
        linkedItemCount: 13,
        issueCount: 0,
        availableUpgradeCount: 0,
        availableUpgradeIssueCount: 0,
        isDefault: true,
        status: "ready",
      }),
      "13 included"
    );
    assert.equal(
      formatPackageScopeCountLine({
        optionId: "b",
        optionLabel: "Enhanced",
        sectionCount: 1,
        catalogSectionCount: 1,
        linkedItemCount: 14,
        issueCount: 0,
        availableUpgradeCount: 1,
        availableUpgradeIssueCount: 0,
        isDefault: false,
        status: "ready",
      }),
      "14 included · 1 optional upgrade"
    );
    assert.equal(PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL, "Included work");
  });

  test("V2E4: empty optional upgrades stay a sibling section with a quiet add action", () => {
    const upgrades = read("tools/roofing/templates/TemplatesAvailableUpgradesManager.tsx");
    assert.match(upgrades, /data-templates-available-upgrades-empty/);
    assert.match(upgrades, /TEMPLATES_AVAILABLE_UPGRADES_HEADING/);
    assert.match(upgrades, /TEMPLATES_ADD_OPTIONAL_UPGRADE_ACTION/);
    assert.doesNotMatch(upgrades, /No optional upgrades prepared for this package/);
    assert.doesNotMatch(upgrades, /selected later in Builder/);
  });

  test("V2E5: production starter packet has no smoke or recommendation copy", () => {
    const starter = [
      DEFAULT_PACKET_OVERVIEW_BODY,
      DEFAULT_PACKET_SCOPE_NOTES_BODY,
      DEFAULT_PACKET_WARRANTY_BODY,
      DEFAULT_PACKET_TERMS_BODY,
    ].join("\n");
    assert.doesNotMatch(starter, /R3A SMOKE TEST/i);
    assert.doesNotMatch(starter, /recommended path/i);
    assert.doesNotMatch(starter, /\bapprove(?:d|s|al)?\b|\baccept(?:ed|ance)?\b|\bsign(?:ed|ature)?\b/i);
    const option = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0]?.options?.[0];
    const overview = option?.sections?.find((row) => row.seed_key?.endsWith(".overview"));
    assert.equal(overview?.content?.body_markdown, DEFAULT_PACKET_OVERVIEW_BODY);
    const onePackage = GUIDED_PACKAGE_MODEL_CHOICES.find((row) => row.id === "single");
    assert.doesNotMatch(onePackage?.description ?? "", /recommended/i);
    const names = (option?.sections ?? []).map((row) => row.name);
    assert.deepEqual(
      names.filter((name) =>
        ["Overview", "Project notes", "Warranty and protection", "Next steps"].includes(name ?? "")
      ),
      ["Overview", "Project notes", "Warranty and protection", "Next steps"]
    );
  });

  test("V2E5: packet wording stays simple and does not expose schema", () => {
    const editor = read("tools/roofing/templates/TemplatesPacketWordingEditor.tsx");
    const flow = read("tools/roofing/templates/templatesSetupPacketWording.ts");
    assert.match(editor, /TEMPLATES_PACKET_EDIT_ACTION/);
    assert.match(flow, /Edit customer wording/);
    assert.doesNotMatch(editor, /content_json|page_type|token internals/);
    assert.match(flow, /Existing drafts keep their copied text/);
  });

  test("arbitrary package counts stay first-class in count formatting", () => {
    assert.match(
      formatPackageScopeCountLine({
        optionId: "custom",
        optionLabel: "Good / Better Custom",
        sectionCount: 1,
        catalogSectionCount: 1,
        linkedItemCount: 4,
        issueCount: 0,
        availableUpgradeCount: 2,
        availableUpgradeIssueCount: 0,
        isDefault: false,
        status: "ready",
      }),
      /4 included · 2 optional upgrades/
    );
  });

  test("V2E6 freeze: 3-step create, landing wording owner, Starting package, no Instant Quote path", () => {
    const planner = read("tools/roofing/templates/templatesGuidedCreatePlanner.ts");
    const overlay = read("tools/roofing/templates/TemplatesGuidedCreateOverlay.tsx");
    const workspace = read("tools/roofing/templates/TemplatesSelectedWorkspace.tsx");
    const review = read("tools/roofing/templates/TemplatesQuoteSetupReview.tsx");
    const flow = read("tools/roofing/templates/templatesWorkspaceFlow.ts");
    const jobCard = read("tools/roofing/jobCard/jobCardCreateProposalModalModel.ts");
    const setup = read("tools/roofing/templates/TemplatesSetupClient.tsx");
    assert.match(planner, /"package_setup",\s*"confirm"/);
    assert.doesNotMatch(overlay, /data-templates-guided-create-panel-structure/);
    assert.doesNotMatch(overlay, /data-templates-guided-create-panel-packet=/);
    assert.match(overlay, /data-templates-guided-create-review-structure/);
    assert.match(overlay, /data-templates-guided-create-review-packet/);
    assert.doesNotMatch(flow, /Content, warranty & terms/);
    assert.doesNotMatch(workspace, /TemplatesContentEditorShell/);
    assert.match(review, /TemplatesPacketWordingEditor/);
    assert.match(jobCard, /Starting package/);
    assert.doesNotMatch(jobCard, /Recommended package/);
    assert.doesNotMatch(setup, /instantQuote|instant_quote|copilotWrite|createCopilot/i);
    assert.doesNotMatch(planner, /instantQuote|instant_quote/i);
  });
});
