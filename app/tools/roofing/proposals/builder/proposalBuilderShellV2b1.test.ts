/**
 * V2B1 — Builder command shell, page switcher, compact package band.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderShellV2b1.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("V2B1 Builder shell", () => {
  test("command bar shows job/customer identity, not Proposal Builder hero", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.match(header, /data-builder-command-bar/);
    assert.match(header, /data-builder-job-primary-identity/);
    assert.match(header, /data-builder-job-secondary-identity/);
    assert.match(header, /data-builder-back-to-job-card/);
    assert.match(header, /Back to Job Card/);
    assert.doesNotMatch(header, /Proposal Builder/);
    assert.doesNotMatch(header, /Editing Roof replacement proposal/);
    assert.doesNotMatch(header, /Pricing ready/);
    assert.doesNotMatch(header, /pricingStateLabel/);
    assert.doesNotMatch(header, /rounded-2xl|shadow-\[0_18px/);
  });

  test("package appears once in command context; total only from loaded preview truth", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(header, /data-builder-command-package/);
    assert.match(header, /data-builder-command-total/);
    assert.match(header, /proposalTotalLabel/);
    assert.match(client, /customerTotalCents/);
    assert.match(client, /formatPriceCents\(selectedOptionCustomerView\.customerTotalCents\)/);
    assert.match(client, /selectedOptionCustomerView\?\.pricingComplete/);
    assert.doesNotMatch(client, /pricingStateLabel/);
    assert.doesNotMatch(client, /Pricing ready/);
  });

  test("Customer review uses existing Preview lock and href; no Send", () => {
    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const constants = read(
      "app/tools/roofing/proposals/builder/proposalBuilderConstants.ts"
    );
    assert.match(constants, /BUILDER_CUSTOMER_REVIEW_LABEL = "Customer review"/);
    assert.match(actions, /BUILDER_CUSTOMER_REVIEW_LABEL/);
    assert.match(actions, /data-builder-customer-review-action/);
    assert.match(actions, /data-builder-preview-action/);
    assert.match(actions, /actionId === "preview"/);
    assert.match(actions, /onLifecycleAction\?\.\("preview"\)/);
    assert.doesNotMatch(actions, /Preview proposal/);
    assert.doesNotMatch(actions, /Preview \+ Send/);
    assert.doesNotMatch(actions, /Send proposal/);
    assert.doesNotMatch(actions, /actionId === "send"/);
    assert.match(client, /buildProposalCustomerPreviewHref/);
    assert.match(client, /if \(actionId !== "preview"\) return/);
  });

  test("page switcher keeps Cover, Estimate, and current pages; mobile is not a clipped tab row", () => {
    const nav = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderSectionNav.tsx"
    );
    assert.match(nav, /data-builder-document-section-nav/);
    assert.match(nav, /data-builder-page-switcher-compact/);
    assert.match(nav, /data-builder-page-switcher-trigger/);
    assert.match(nav, /role="tablist"/);
    assert.match(nav, /role="tab"/);
    assert.match(nav, /aria-selected=\{isActive\}/);
    assert.match(nav, /buildPageContextStripItems/);
    assert.doesNotMatch(nav, /overflow-x-auto(?!.*sm:)/);
    assert.match(nav, /item\.id !== "preview" && item\.id !== "add_page"/);
  });

  test("healthy package band is compact; no CURRENT/AVAILABLE badges or nested card", () => {
    const zone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(zone, /data-builder-package-selected-summary/);
    assert.match(zone, /data-builder-package-title/);
    assert.match(zone, /data-builder-package-total/);
    assert.match(zone, /packageTotalLabel/);
    assert.match(zone, /Change package|data-builder-change-package|ProposalBuilderPackageSelector/);
    assert.doesNotMatch(zone, />Current</);
    assert.doesNotMatch(zone, /\bAVAILABLE\b/);
    assert.doesNotMatch(zone, /Selected package/);
    assert.doesNotMatch(zone, /rounded-lg border border-slate-200\/70 bg-slate-50/);
    assert.doesNotMatch(zone, /onSelectOption\(/);
  });

  test("package total comes from existing estimate presenter truth; picker still opens from Change package", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(estimate, /presentation\.totalsZone\.showAmounts/);
    assert.match(estimate, /presentation\.totalsZone\.totalLabel/);
    assert.match(estimate, /packageTotalLabel=/);
    assert.match(selector, /data-builder-change-package/);
    assert.match(selector, /onPickerOpenChange/);
    assert.doesNotMatch(estimate, /Proposal estimate/i);
    assert.doesNotMatch(estimate, /Build and review the customer estimate/);
    assert.doesNotMatch(estimate, /Preview \+ Send/);
  });

  test("blocked/unready shell does not invent package, save, or review-count context", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(header, /shellReady \? \(selectedPackageLabel/);
    assert.match(header, /shellReady \? \(proposalTotalLabel/);
    assert.match(header, /shellReady \? \(lastSavedLabel/);
    assert.match(header, /\{shellReady \? \(/);
    assert.match(client, /selectedPackageLabel=\{\s*shellReady/);
    assert.match(client, /lastSavedLabel=\{shellReady \? lastSavedLabel : null\}/);
    assert.match(client, /formatBuilderLastSavedLabel[\s\S]*return null/);
    assert.doesNotMatch(client, /return "—"/);
  });

  test("workspace is a continuous document surface, not a dashboard card", () => {
    const layout = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkspaceLayout.tsx"
    );
    assert.match(layout, /data-builder-workspace-shell/);
    assert.match(layout, /border-t border-slate-200\/80 bg-white/);
    assert.doesNotMatch(layout, /rounded-xl border border-slate-200\/70 bg-white shadow-/);
    assert.doesNotMatch(layout, /ProposalBuilderSummaryRail/);
  });

  test("protected writes and Preview route are unchanged in this slice", () => {
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(client, /updateDraftSelectedOption/);
    assert.match(client, /handleRefreshDraftPricing/);
    assert.match(client, /ProposalBuilderCustomerRequestBanner/);
    assert.match(client, /buildProposalCustomerPreviewHref\(jobId, proposalId\)/);
    assert.match(estimate, /onApplyManualQuantity/);
    assert.match(estimate, /onExcludeLine/);
    assert.match(estimate, /onRestoreExcludedLine/);
    assert.match(estimate, /onSetUpgradeSelected/);
    assert.match(estimate, /focusFinishEstimate/);
    assert.match(estimate, /openEditPackage/);
  });
});
