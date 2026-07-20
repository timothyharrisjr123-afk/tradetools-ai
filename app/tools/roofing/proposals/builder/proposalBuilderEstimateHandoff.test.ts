/**
 * Block 4 / 4B — Builder estimate handoff + document-led layout contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Builder estimate handoff (Block 4 / 4B)", () => {
  test("1. Builder route does not highlight Proposal templates", () => {
    const appPage = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderAppPage.tsx"
    );
    assert.match(appPage, /activeNav="jobs"/);
    assert.doesNotMatch(appPage, /activeNav="templates"/);
  });

  test("2. Builder header shows job identity, proposal title, selected package", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.match(header, /data-builder-job-primary-identity/);
    assert.match(header, /data-builder-handoff-meta/);
    assert.match(header, /proposalTitle/);
    assert.match(header, /selectedPackageLabel/);
  });

  test("3. Document-led layout: section nav + canvas; no primary horizontal strip / rail", () => {
    const layout = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkspaceLayout.tsx"
    );
    assert.match(layout, /data-builder-document-led/);
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

  test("4. Right rail does not duplicate next-step; one next-step on Estimate", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    assert.match(estimate, /data-builder-estimate-next-step/);
    assert.match(estimate, /data-builder-review-quantities/);
    assert.match(estimate, /Needs review/);

    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.doesNotMatch(client, /ProposalBuilderSummaryRail/);
  });

  test("5. No yellow warning banner as first primary visual for drafts", () => {
    const alerts = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageAlerts.tsx"
    );
    assert.doesNotMatch(alerts, /BUILDER_READ_ONLY_ALERT_COMPACT/);
    assert.doesNotMatch(alerts, /bg-amber-50/);
    assert.match(alerts, /hasPersistedDraft/);
  });

  test("6. Snapshot note is collapsed/quiet", () => {
    const client = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.match(client, /Snapshot details/);
    assert.match(client, /data-builder-snapshot-frozen-helper/);
    assert.match(client, /<details/);
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

  test("8. Included estimate before upgrades; quantity review compact", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const bodyStart = estimate.indexOf("data-builder-estimate-document");
    const body = estimate.slice(bodyStart);
    const included = body.indexOf("<ProposalBuilderWorkbenchReadyScopeZone");
    const attention = body.indexOf("<ProposalBuilderWorkbenchAttentionZone");
    const upgrades = body.indexOf("<ProposalBuilderWorkbenchUpgradesZone");
    assert.ok(included > 0 && included < attention && attention < upgrades);

    const attentionSrc = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx"
    );
    assert.match(attentionSrc, /data-builder-quantity-review/);
    assert.match(attentionSrc, /data-builder-set-quantity/);
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
    // Disabled Remove chips must not compete with Set quantity.
    assert.doesNotMatch(
      attention,
      /isSetQuantity \|\| isRemove/
    );
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

  test("12. Package helper uses proposal; package compact", () => {
    const pkg = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    assert.match(pkg, /data-builder-package-compact/);
    assert.match(pkg, /startingPackageHelper/);
    assert.match(pkg, /\bcompact\b/);
    assert.doesNotMatch(pkg, /signing/i);

    const selector = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx"
    );
    assert.match(selector, /data-builder-package-compact-controls/);
  });

  test("13. Builder package picker draft-option scoping preserved", () => {
    const picker = read(
      "app/tools/roofing/proposals/builder/proposalBuilderPackageSelector.test.ts"
    );
    assert.match(picker, /draftScoped|selected_option_id/i);
  });
});
