/**
 * Block 4 / 4B / 4C — Builder handoff + document-led + visual continuity contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Builder estimate handoff (Block 4 / 4B / 4C)", () => {
  test("1. Builder route does not highlight Proposal templates", () => {
    const appPage = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderAppPage.tsx"
    );
    assert.match(appPage, /activeNav="jobs"/);
    assert.doesNotMatch(appPage, /activeNav="templates"/);
  });

  test("2. Header primary title is proposal title; package · Draft status line", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.match(header, /data-builder-proposal-primary-title/);
    assert.match(header, /data-builder-package-status-line/);
    assert.match(header, /data-builder-handoff-meta/);
    assert.match(header, /proposalTitle/);
    assert.match(header, /selectedPackageLabel/);
    assert.match(header, /\$\{packageLabel\} package/);
    assert.match(header, /Draft/);
    assert.doesNotMatch(header, /Proposal Workspace/i);
    assert.doesNotMatch(header, /BUILDER_HEADER_WORKSPACE_KICKER/);
    assert.doesNotMatch(header, /data-builder-job-primary-identity/);
  });

  test("3. Document-led attached workspace: section nav + canvas shell", () => {
    const layout = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkspaceLayout.tsx"
    );
    assert.match(layout, /data-builder-document-led/);
    assert.match(layout, /data-builder-workspace-attached/);
    assert.match(layout, /data-builder-workspace-shell/);
    assert.match(layout, /sectionNav/);
    assert.match(layout, /data-builder-document-canvas/);

    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.match(client, /ProposalBuilderSectionNav/);
    assert.doesNotMatch(client, /ProposalBuilderPageContextStrip/);
    assert.doesNotMatch(client, /ProposalBuilderSummaryRail/);
    assert.doesNotMatch(client, /summaryRail=\{/);

    const sectionNav = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderSectionNav.tsx"
    );
    assert.match(sectionNav, /data-builder-document-section-nav/);
    assert.match(sectionNav, /Active/);
  });

  test("4. Compact needs-review strip; Finish estimate language", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /data-builder-estimate-next-step/);
    assert.match(estimate, /data-builder-needs-review-strip/);
    assert.match(estimate, /data-builder-review-quantities/);
    assert.match(estimate, /Needs review:/);

    const attentionSrc = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.match(attentionSrc, /data-builder-finish-estimate/);
    assert.match(attentionSrc, /Finish estimate/);
    assert.doesNotMatch(attentionSrc, /Needs quantity review/);
  });

  test("5. No yellow warning banner as first primary visual for drafts", () => {
    const alerts = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageAlerts.tsx"
    );
    assert.doesNotMatch(alerts, /BUILDER_READ_ONLY_ALERT_COMPACT/);
    assert.doesNotMatch(alerts, /bg-amber-50/);
    assert.match(alerts, /hasPersistedDraft/);
  });

  test("6. Snapshot details not primary; Saved pricing details under More", () => {
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.doesNotMatch(client, /Snapshot details/);
    assert.match(client, /savedPricingDetails=/);
    assert.match(client, /PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY/);

    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    assert.match(actions, /Saved pricing details/);
    assert.match(actions, /data-builder-saved-pricing-details/);
    assert.match(actions, /data-builder-snapshot-frozen-helper/);
    assert.doesNotMatch(actions, /Snapshot details/);
  });

  test("7. Display settings not a large card above included estimate", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const bodyStart = estimate.indexOf("data-builder-estimate-document");
    const body = estimate.slice(bodyStart);
    const readyIdx = body.indexOf("<ProposalBuilderWorkbenchReadyScopeZone");
    const settingsIdx = body.indexOf("<ProposalBuilderWorkbenchSettingsEntry");
    assert.ok(readyIdx > 0 && settingsIdx > readyIdx);

    const settings = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchSettingsEntry.tsx"
    );
    assert.match(settings, /data-builder-display-settings/);
    assert.match(settings, /<details/);
    assert.match(settings, /\bDisplay\b/);
  });

  test("8. Included estimate table-like; no Roof replacement scope duplicate", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.match(ready, /data-builder-included-estimate/);
    assert.match(ready, /data-builder-included-estimate-table/);
    assert.match(ready, /data-builder-estimate-column-headers/);
    assert.match(ready, /hideDetails/);
    assert.doesNotMatch(ready, /Roof replacement scope/);

    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const bodyStart = estimate.indexOf("data-builder-estimate-document");
    const body = estimate.slice(bodyStart);
    const included = body.indexOf("<ProposalBuilderWorkbenchReadyScopeZone");
    const attention = body.indexOf("<ProposalBuilderWorkbenchAttentionZone");
    const upgrades = body.indexOf("<ProposalBuilderWorkbenchUpgradesZone");
    assert.ok(included > 0 && included < attention && attention < upgrades);
  });

  test("9. Remove from proposal not primary on included / quantity review", () => {
    const ready = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx"
    );
    assert.doesNotMatch(ready, /onRemoveFromOption/);

    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /excludeEnabled=\{false\}/);

    const attention = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.doesNotMatch(attention, /isSetQuantity \|\| isRemove/);
    assert.match(attention, /isRemove && canRemove/);
  });

  test("10. Preview is primary forward action; Back to Job Card retained", () => {
    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    assert.match(actions, /data-builder-preview-action/);
    assert.match(actions, /data-builder-future-actions/);
    assert.match(actions, /\bPreview\b/);

    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.match(header, /data-builder-back-to-job-card/);
  });

  test("11. Hide from customer absent from estimate review path", () => {
    const files = [
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchLineRow.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx",
    ];
    for (const file of files) {
      assert.doesNotMatch(read(file), /Hide from customer/i, file);
    }
  });

  test("12. Package context preserved; no signing language", () => {
    const pkg = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(pkg, /data-builder-package-compact/);
    assert.match(pkg, /data-builder-package-context/);
    assert.match(pkg, /data-builder-package-description/);
    assert.match(pkg, /data-builder-package-bullets/);
    assert.match(pkg, /\bcompact\b/);
    assert.doesNotMatch(pkg, /signing/i);

    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(selector, /data-builder-package-compact-controls/);
    assert.match(selector, /Change package/);

    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    assert.match(upgrades, /data-builder-optional-upgrades/);
    assert.doesNotMatch(upgrades, /signing/i);
    assert.doesNotMatch(upgrades, /customerSelectionHint/);
    // No nested section title card repeating Optional upgrades.
    assert.doesNotMatch(upgrades, /WORKBENCH_SCOPE_SECTION_TITLE/);
    assert.doesNotMatch(upgrades, /section\.title/);
  });

  test("13. Builder package picker draft-option scoping preserved", () => {
    const picker = read(
      "app/tools/roofing/proposals/builder/proposalBuilderPackageSelector.test.ts"
    );
    assert.match(picker, /draftScoped|selected_option_id/i);
  });
});
