/**
 * V2F1 — Full-draft dirty truth goldens.
 * Job Card lifecycle and send-prep must share proposals.updated_at > frozen_at.
 *
 * Run: npx tsx --test app/lib/proposalMutableDraftDirtyTruth.v2f1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  deriveContractorProposalLifecycle,
  isMutableDraftDirtyAfterSentFreeze,
} from "./proposalContractorLifecycle";
import { needsSendPrepRefreeze } from "./proposalSendPrep";
import { buildJobCardProposalRowView } from "../tools/roofing/jobCard/jobCardProposalsTabModel";
import type { ProposalRecordStatusSummary } from "./proposalRecordTypes";

const ROOT = process.cwd();
const SENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPOSAL_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FROZEN = "2026-07-22T16:31:00.000Z";
const AFTER = "2026-07-23T12:00:00.000Z";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function summary(
  partial: Partial<ProposalRecordStatusSummary> & { id: string }
): ProposalRecordStatusSummary {
  return {
    id: partial.id,
    job_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    status: partial.status ?? "draft",
    title: partial.title ?? "Roof replacement",
    proposal_number: null,
    template_id: "tmpl-roof",
    selected_option_id: partial.selected_option_id ?? null,
    latest_sent_version_id: partial.latest_sent_version_id ?? null,
    signed_version_id: partial.signed_version_id ?? null,
    created_at: null,
    updated_at: partial.updated_at ?? FROZEN,
  };
}

function jobCardKind(draftUpdatedAt: string, frozenAt: string | null) {
  return deriveContractorProposalLifecycle({
    latestSentVersionId: SENT_ID,
    draftUpdatedAt,
    latestSentFrozenAt: frozenAt,
  }).kind;
}

function sendPrepDirty(draftUpdatedAt: string, frozenAt: string | null) {
  return needsSendPrepRefreeze({
    hasSentSnapshot: true,
    hasSignedSnapshot: false,
    draftUpdatedAt,
    sentVersionFrozenAt: frozenAt,
    pricingStale: false,
  });
}

function assertJobCardAndSendPrepAgree(draftUpdatedAt: string, frozenAt: string) {
  const dirty = isMutableDraftDirtyAfterSentFreeze({
    draftUpdatedAt,
    latestSentFrozenAt: frozenAt,
  });
  const kind = jobCardKind(draftUpdatedAt, frozenAt);
  const refreeze = sendPrepDirty(draftUpdatedAt, frozenAt);
  assert.equal(refreeze, dirty);
  if (dirty) {
    assert.equal(kind, "revision_in_progress");
  } else {
    assert.equal(kind, "sent");
  }
}

describe("V2F1 full-draft dirty truth — baseline", () => {
  test("just-frozen equal timestamps = Sent and no send-prep refreeze", () => {
    assertJobCardAndSendPrepAgree(FROZEN, FROZEN);
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: PROPOSAL_ID,
        latest_sent_version_id: SENT_ID,
        updated_at: FROZEN,
      }),
      sentFacts: { latestSentFrozenAt: FROZEN },
    });
    assert.equal(row.lifecycleKind, "sent");
    assert.equal(row.statusLabel, "Sent");
  });

  test("no mutation after freeze stays Sent", () => {
    assertJobCardAndSendPrepAgree(FROZEN, FROZEN);
  });
});

describe("V2F1 full-draft dirty truth — header / option / pages / lines", () => {
  test("selected package / page / line / pricing header bump => Revision in progress", () => {
    assertJobCardAndSendPrepAgree(AFTER, FROZEN);
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: PROPOSAL_ID,
        latest_sent_version_id: SENT_ID,
        updated_at: AFTER,
      }),
      sentFacts: { latestSentFrozenAt: FROZEN },
    });
    assert.equal(row.lifecycleKind, "revision_in_progress");
    assert.equal(row.statusLabel, "Revision in progress");
  });

  test("persist ownership touches proposals.updated_at for customer-visible draft writes", () => {
    const pageStore = read("app/lib/proposalRecordStore.ts");
    assert.match(pageStore, /async function updateDraftProposalPageContent/);
    const contentFn = pageStore.slice(
      pageStore.indexOf("export async function updateDraftProposalPageContent")
    );
    const visibilityFn = pageStore.slice(
      pageStore.indexOf("export async function updateDraftProposalPageVisibility")
    );
    const settingsFn = pageStore.slice(
      pageStore.indexOf("export async function updateDraftProposalPageSettings")
    );
    const selectedFn = pageStore.slice(
      pageStore.indexOf("export async function updateDraftSelectedOption")
    );
    assert.match(contentFn.slice(0, 2500), /touchMutableDraftHeader/);
    assert.match(visibilityFn.slice(0, 2800), /touchMutableDraftHeader/);
    assert.match(settingsFn.slice(0, 2800), /touchMutableDraftHeader/);
    assert.match(selectedFn.slice(0, 2200), /from\("proposals"\)[\s\S]*selected_option_id/);

    const pricing = read("app/lib/proposalDraftPricingRefreshPersistence.ts");
    assert.match(pricing, /touchMutableDraftProposalUpdatedAt/);
    const viaRpc = pricing.slice(pricing.indexOf("export async function persistDraftPricingRefreshViaRpc"));
    const sequential = pricing.slice(
      pricing.indexOf("export async function persistDraftPricingRefreshSequential")
    );
    assert.match(viaRpc.slice(0, 1200), /touchMutableDraftProposalUpdatedAt/);
    assert.match(sequential.slice(0, 9000), /touchMutableDraftProposalUpdatedAt/);

    const scope = read("app/lib/proposalScopeDecisionStore.ts");
    assert.match(scope, /touchMutableDraftHeader/);
    const upsert = scope.slice(scope.indexOf("export async function upsertDraftScopeDecision"));
    const clear = scope.slice(scope.indexOf("export async function clearDraftScopeDecision("));
    const clearTarget = scope.slice(
      scope.indexOf("export async function clearDraftScopeDecisionByTarget(")
    );
    assert.match(upsert.slice(0, 4500), /touchMutableDraftHeader/);
    assert.match(clear.slice(0, 2500), /touchMutableDraftHeader/);
    assert.match(clearTarget.slice(0, 3500), /touchMutableDraftHeader/);

    const upgrades = read("app/lib/proposalUpgradeChoiceStore.ts");
    const upgradeUpsert = upgrades.slice(
      upgrades.indexOf("export async function upsertUpgradeChoiceSelection")
    );
    assert.match(upgradeUpsert.slice(0, 4500), /touchMutableDraftHeader/);
  });

  test("no draft page-order persist path exists; if added it must touch the header", () => {
    const store = read("app/lib/proposalRecordStore.ts");
    assert.doesNotMatch(store, /updateDraftProposalPageOrder|reorderDraftProposalPages/);
    const builder = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.doesNotMatch(builder, /sort_order:.+updateDraft|updateDraft.+sort_order/);
  });

  test("no draft package description/customer_label persist path; template edits stay isolated", () => {
    const store = read("app/lib/proposalRecordStore.ts");
    assert.doesNotMatch(store, /updateDraftProposalOption|updateDraftOptionLabel|updateDraftOptionDescription/);
    const templates = read("app/lib/proposalTemplateStore.ts");
    assert.doesNotMatch(templates, /from\("proposals"\)/);
    assert.doesNotMatch(templates, /touchMutableDraftProposalUpdatedAt/);
  });
});

describe("V2F1 full-draft dirty truth — send-prep agreement", () => {
  test("send-prep uses the shared dirty helper for parsed timestamps", () => {
    const sendPrep = read("app/lib/proposalSendPrep.ts");
    assert.match(sendPrep, /isMutableDraftDirtyAfterSentFreeze/);
    assert.match(sendPrep, /from "@\/app\/lib\/proposalContractorLifecycle"/);
  });

  test("pricingStale still refreezes without inventing Job Card revision", () => {
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: false,
        draftUpdatedAt: FROZEN,
        sentVersionFrozenAt: FROZEN,
        pricingStale: true,
      }),
      true
    );
    assert.equal(jobCardKind(FROZEN, FROZEN), "sent");
  });
});

describe("V2F1 full-draft dirty truth — negatives do not touch header", () => {
  test("Job Card load / lifecycle presentation do not write proposals", () => {
    const files = [
      "app/lib/proposalJobCardLifecycleRead.ts",
      "app/lib/proposalContractorLifecycle.ts",
      "app/lib/proposalJobCardSentHistory.ts",
      "app/tools/roofing/jobCard/jobCardProposalsTabModel.ts",
      "app/tools/roofing/jobCard/JobCardProposalsTab.tsx",
    ];
    for (const rel of files) {
      const source = read(rel);
      assert.doesNotMatch(source, /\.from\("proposals"\)\s*\.update/);
      assert.doesNotMatch(source, /jobs\.stage\s*=/);
    }
  });

  test("Builder/Preview clients do not own the dirty-touch write", () => {
    const builder = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.doesNotMatch(builder, /touchMutableDraftProposalUpdatedAt/);
    const preview = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx"
    );
    assert.doesNotMatch(preview, /touchMutableDraftProposalUpdatedAt/);
    assert.doesNotMatch(preview, /updateDraftProposalPageContent/);
    assert.doesNotMatch(preview, /refreshDraftPricing\(/);
  });

  test("delivery, attention, events, and customer requests do not dirty draft", () => {
    const delivery = read("app/lib/proposalDeliveryAttemptPersistence.ts");
    assert.doesNotMatch(delivery, /touchMutableDraftProposalUpdatedAt/);
    assert.doesNotMatch(delivery, /from\("proposals"\)/);

    const events = read("app/lib/proposalRecordStore.ts");
    const append = events.slice(events.indexOf("export async function appendProposalEvent"));
    assert.doesNotMatch(append.slice(0, 1200), /touchMutableDraftHeader/);
    assert.doesNotMatch(append.slice(0, 1200), /from\("proposals"\)/);

    const requests = read("app/lib/proposalCustomerRequestPersistence.ts");
    assert.doesNotMatch(requests, /touchMutableDraftProposalUpdatedAt/);
    assert.doesNotMatch(requests, /from\("proposals"\)/);

    const attention = read("app/lib/jobAttentionReadModel.ts");
    assert.doesNotMatch(attention, /touchMutableDraftProposalUpdatedAt/);
    assert.doesNotMatch(attention, /from\("proposals"\)/);
  });

  test("Job Card proposal row does not duplicate Activity or Attention owners", () => {
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    assert.doesNotMatch(tab, /JobCardActivityPanel/);
    assert.doesNotMatch(tab, /JobCardNextActionPanel/);
    assert.doesNotMatch(tab, /Needs attention/i);
    const harness = read("app/tools/roofing/jobCard/JobCardV2f1ReviewHarness.tsx");
    assert.match(harness, /JobCardActivityPanel/);
    assert.match(harness, /JobCardNextActionPanel/);
    assert.match(harness, /JobCardHeader/);
    assert.match(harness, /JobCardMetadataStrip/);
    assert.doesNotMatch(harness, /CustomerRequestReviewCard/);
  });

  test("one authoritative helper; Job Card does not scan child rows", () => {
    const lifecycle = read("app/lib/proposalContractorLifecycle.ts");
    assert.match(lifecycle, /isMutableDraftDirtyAfterSentFreeze/);
    assert.doesNotMatch(lifecycle, /proposal_pages|proposal_line_items|proposal_options/);
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    assert.doesNotMatch(tab, /bg-slate-50\/70/);
    assert.match(tab, /shouldRenderProposalAction/);
    const touch = read("app/lib/proposalMutableDraftTouch.ts");
    assert.match(touch, /from\("proposals"\)/);
    assert.match(touch, /updated_at: touchedAt/);
  });
});
