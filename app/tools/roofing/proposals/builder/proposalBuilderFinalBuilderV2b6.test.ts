/**
 * V2B6 — final Builder consolidation.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderFinalBuilderV2b6.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";
import { buildProposalBuilderHref } from "@/app/lib/proposalBuilderReadiness";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function builderFile(name: string): string {
  return path.join(root, "app/tools/roofing/proposals/builder", name);
}

describe("V2B6 final Builder consolidation", () => {
  test("canonical Builder href requires job + proposal; job-only goes to Job Card", () => {
    const job = "c9497cc1-c8d2-406e-8455-5a6f9cc369d3";
    const proposal = "145d910c-8c52-4a1d-b04a-41e9b130fc09";
    assert.match(
      buildProposalBuilderHref(job, proposal),
      /\/tools\/roofing\/proposals\/builder\?job=.*&proposal=/
    );
    assert.equal(
      buildProposalBuilderHref(job),
      `/tools/roofing?entry=job-card&job=${encodeURIComponent(job)}&tab=proposals`
    );
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.match(client, /setupPreviewRetired/);
    assert.match(client, /router\.replace\(buildJobCardHref/);
    assert.match(client, /data-builder-setup-preview-retired/);
    assert.doesNotMatch(client, /void loadTemplates\(\)/);
  });

  test("blocked state is a single truthful surface", () => {
    const blocked = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderBlockedState.tsx"
    );
    assert.match(blocked, /data-builder-blocked-state/);
    assert.match(blocked, /Choose a job first/);
    assert.match(blocked, /Open a job before creating a proposal/);
    assert.match(blocked, /Open Jobs/);
    assert.doesNotMatch(blocked, /clean DB|database|fixture|smoke|harness/i);
    assert.doesNotMatch(blocked, /No proposal record is created/);
    assert.doesNotMatch(blocked, /blockedGates\.length > 1/);
    assert.doesNotMatch(blocked, /bg-amber-50/);
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.match(client, /primaryGate !== "missing_job"/);
  });

  test("no setup-preview ghost metadata or quiet note", () => {
    const alerts = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageAlerts.tsx"
    );
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.doesNotMatch(alerts, /data-builder-setup-quiet-note/);
    assert.doesNotMatch(alerts, /Setup preview/);
    assert.doesNotMatch(client, /hasPersistedDraft=/);
    assert.match(header, /shellReady \? \(selectedPackageLabel/);
    assert.match(header, /\{shellReady \? \(/);
  });

  test("no duplicate readiness chrome; qty/stale/request stay single owners", () => {
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(client, /data-builder-stale-banner/);
    assert.match(client, /handleRefreshDraftPricing/);
    assert.match(client, /ProposalBuilderCustomerRequestBanner/);
    assert.match(estimate, /data-builder-estimate-quantity-review/);
    assert.match(estimate, /data-builder-upgrade-quantity-review/);
    assert.doesNotMatch(client, /ProposalBuilderSummaryRail/);
    assert.doesNotMatch(client, /handleGuidanceNavigate/);
    assert.doesNotMatch(client, /Pricing ready/);
  });

  test("Customer review lock truth is unchanged and has one nearby reason", () => {
    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const guidance = read("app/lib/proposalBuilderGuidance.ts");
    assert.match(actions, /state === "ready" \|\| previewLock\.state === "attention"/);
    assert.match(actions, /data-builder-customer-review-lock-reason/);
    assert.match(actions, /BUILDER_CUSTOMER_REVIEW_LABEL/);
    assert.doesNotMatch(actions, /Send proposal/);
    assert.match(client, /if \(actionId !== "preview"\) return/);
    assert.match(client, /buildProposalCustomerPreviewHref\(jobId, proposalId\)/);
    assert.match(guidance, /CUSTOMER_REVIEW_NEEDS_DRAFT_COPY/);
    assert.match(guidance, /Customer review needs a saved proposal draft/);
    assert.doesNotMatch(guidance, /roadmap phase/);
    assert.doesNotMatch(actions, /roadmap phase/);
  });

  test("stale banner and request banner remain the canonical surfaces", () => {
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const request = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderCustomerRequestBanner.tsx"
    );
    assert.match(client, /data-builder-stale-banner/);
    assert.match(client, /data-builder-refresh-draft-pricing/);
    assert.match(client, /refreshDraftPricing/);
    assert.match(client, /ProposalBuilderCustomerRequestBanner/);
    assert.match(request, /data-builder-customer-request-mark-seen/);
    assert.match(request, /markSeen/);
    assert.match(request, /data-builder-customer-request-action-error/);
    assert.match(request, /actionError/);
    assert.doesNotMatch(request, /jobs\.stage/);
    assert.match(client, /min-h-\[44px\][\s\S]{0,400}data-builder-refresh-draft-pricing/);
    assert.match(request, /min-h-\[44px\][\s\S]{0,400}data-builder-customer-request-mark-seen/);
  });

  test("deleted modules are unreachable", () => {
    const deleted = [
      "ProposalBuilderSummaryRail.tsx",
      "ProposalBuilderPageContextStrip.tsx",
      "ProposalBuilderOptionTabs.tsx",
      "ProposalBuilderDocumentTotals.tsx",
      "ProposalBuilderSectionPreview.tsx",
      "ProposalBuilderLinePreviewTable.tsx",
      "ProposalBuilderWorkbenchSettingsEntry.tsx",
      "ProposalBuilderPackageCards.tsx",
      "ProposalBuilderWorkbenchEditOptionShell.tsx",
    ];
    for (const file of deleted) {
      assert.equal(existsSync(builderFile(file)), false, file);
    }
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.doesNotMatch(client, /ProposalBuilderSummaryRail/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchEditOptionShell/);
    assert.doesNotMatch(estimate, /ProposalBuilderWorkbenchSettingsEntry/);
    assert.doesNotMatch(attention, /Finish estimate/);
    assert.doesNotMatch(attention, /data-builder-finish-estimate/);
  });

  test("V2B1–V2B5 persist and surfaces remain in place", () => {
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    const editor = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageEditor.tsx"
    );
    assert.match(actions, /BUILDER_CUSTOMER_REVIEW_LABEL/);
    assert.match(client, /updateDraftSelectedOption/);
    assert.match(client, /applyManualQuantityScopeDecision/);
    assert.match(client, /upsertUpgradeChoiceSelection/);
    assert.match(client, /updateDraftProposalPageContent/);
    assert.match(estimate, /data-builder-review-upgrades/);
    const packageZone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(packageZone, /ProposalBuilderPackageSelector/);
    assert.match(editor, /data-builder-page-save/);
    assert.doesNotMatch(client, /proposalPricingEngine/);
  });
});
