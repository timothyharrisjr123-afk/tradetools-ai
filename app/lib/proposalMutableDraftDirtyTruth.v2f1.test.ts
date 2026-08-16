/**
 * V2F1 — Full-draft dirty truth goldens.
 * Job Card lifecycle and send-prep must share
 * proposals.draft_content_changed_at > frozen_at.
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
const HEADER_AFTER_FREEZE = "2026-07-22T16:31:00.400Z";

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
    draft_content_changed_at: partial.draft_content_changed_at ?? FROZEN,
  };
}

function jobCardKind(draftContentChangedAt: string, frozenAt: string | null) {
  return deriveContractorProposalLifecycle({
    latestSentVersionId: SENT_ID,
    draftContentChangedAt,
    latestSentFrozenAt: frozenAt,
  }).kind;
}

function sendPrepDirty(draftContentChangedAt: string, frozenAt: string | null) {
  return needsSendPrepRefreeze({
    hasSentSnapshot: true,
    hasSignedSnapshot: false,
    draftContentChangedAt,
    sentVersionFrozenAt: frozenAt,
    pricingStale: false,
  });
}

function assertJobCardAndSendPrepAgree(draftContentChangedAt: string, frozenAt: string) {
  const dirty = isMutableDraftDirtyAfterSentFreeze({
    draftContentChangedAt,
    latestSentFrozenAt: frozenAt,
  });
  const kind = jobCardKind(draftContentChangedAt, frozenAt);
  const refreeze = sendPrepDirty(draftContentChangedAt, frozenAt);
  assert.equal(refreeze, dirty);
  if (dirty) {
    assert.equal(kind, "revision_in_progress");
  } else {
    assert.equal(kind, "sent");
  }
}

describe("V2F1 full-draft dirty truth — baseline", () => {
  test("just-frozen equal clocks = Sent and no send-prep refreeze", () => {
    assertJobCardAndSendPrepAgree(FROZEN, FROZEN);
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: PROPOSAL_ID,
        latest_sent_version_id: SENT_ID,
        updated_at: HEADER_AFTER_FREEZE,
        draft_content_changed_at: FROZEN,
      }),
      sentFacts: { latestSentFrozenAt: FROZEN },
    });
    assert.equal(row.lifecycleKind, "sent");
    assert.equal(row.statusLabel, "Sent");
  });

  test("generic updated_at after freeze does not invent Revision in progress", () => {
    assertJobCardAndSendPrepAgree(FROZEN, FROZEN);
    assert.equal(
      isMutableDraftDirtyAfterSentFreeze({
        draftContentChangedAt: FROZEN,
        latestSentFrozenAt: FROZEN,
      }),
      false
    );
  });
});

describe("V2F1 full-draft dirty truth — content clock", () => {
  test("draft_content_changed_at after frozen_at => Revision in progress", () => {
    assertJobCardAndSendPrepAgree(AFTER, FROZEN);
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: PROPOSAL_ID,
        latest_sent_version_id: SENT_ID,
        updated_at: AFTER,
        draft_content_changed_at: AFTER,
      }),
      sentFacts: { latestSentFrozenAt: FROZEN },
    });
    assert.equal(row.lifecycleKind, "revision_in_progress");
    assert.equal(row.statusLabel, "Revision in progress");
  });

  test("page/scope/upgrade stores do not client-stamp the dirty clock", () => {
    const pageStore = read("app/lib/proposalRecordStore.ts");
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
    assert.doesNotMatch(contentFn.slice(0, 2500), /draft_content_changed_at/);
    assert.doesNotMatch(visibilityFn.slice(0, 2800), /draft_content_changed_at/);
    assert.doesNotMatch(settingsFn.slice(0, 2800), /draft_content_changed_at/);
    assert.doesNotMatch(selectedFn.slice(0, 2200), /draft_content_changed_at/);
    assert.match(selectedFn.slice(0, 2200), /from\("proposals"\)[\s\S]*selected_option_id/);

    const pricing = read("app/lib/proposalDraftPricingRefreshPersistence.ts");
    assert.doesNotMatch(pricing, /draft_content_changed_at/);
    assert.doesNotMatch(pricing, /touchMutableDraftProposalUpdatedAt/);

    const scope = read("app/lib/proposalScopeDecisionStore.ts");
    assert.doesNotMatch(scope, /draft_content_changed_at/);
    assert.doesNotMatch(scope, /touchMutableDraftHeader/);

    const upgrades = read("app/lib/proposalUpgradeChoiceStore.ts");
    assert.doesNotMatch(upgrades, /draft_content_changed_at/);
    assert.doesNotMatch(upgrades, /touchMutableDraftHeader/);
  });

  test("no draft page-order persist path exists; if added it must be draft-scoped trigger owned", () => {
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
    assert.doesNotMatch(templates, /draft_content_changed_at/);
  });
});

describe("V2F1 full-draft dirty truth — send-prep agreement", () => {
  test("send-prep uses the shared dirty helper for parsed timestamps", () => {
    const sendPrep = read("app/lib/proposalSendPrep.ts");
    assert.match(sendPrep, /isMutableDraftDirtyAfterSentFreeze/);
    assert.match(sendPrep, /from "@\/app\/lib\/proposalContractorLifecycle"/);
    assert.match(sendPrep, /draft_content_changed_at/);
    assert.doesNotMatch(
      sendPrep.slice(sendPrep.indexOf("export function needsSendPrepRefreeze")),
      /proposal\.updated_at/
    );
  });

  test("pricingStale still refreezes without inventing Job Card revision", () => {
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: false,
        draftContentChangedAt: FROZEN,
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

  test("Builder/Preview clients do not own the dirty clock", () => {
    const builder = read("app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx");
    assert.doesNotMatch(builder, /draft_content_changed_at/);
    const preview = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx"
    );
    assert.doesNotMatch(preview, /from\("proposals"\)\s*\.update/);
    assert.doesNotMatch(preview, /updateDraftProposalPageContent/);
    assert.doesNotMatch(preview, /refreshDraftPricing\(/);
    assert.match(preview, /draft_content_changed_at/);
  });

  test("delivery, attention, events, and customer requests do not dirty draft", () => {
    const delivery = read("app/lib/proposalDeliveryAttemptPersistence.ts");
    assert.doesNotMatch(delivery, /draft_content_changed_at/);
    assert.doesNotMatch(delivery, /from\("proposals"\)/);

    const events = read("app/lib/proposalRecordStore.ts");
    const append = events.slice(events.indexOf("export async function appendProposalEvent"));
    assert.doesNotMatch(append.slice(0, 1200), /draft_content_changed_at/);
    assert.doesNotMatch(append.slice(0, 1200), /from\("proposals"\)/);

    const requests = read("app/lib/proposalCustomerRequestPersistence.ts");
    assert.doesNotMatch(requests, /draft_content_changed_at/);
    assert.doesNotMatch(requests, /from\("proposals"\)/);

    const attention = read("app/lib/jobAttentionReadModel.ts");
    assert.doesNotMatch(attention, /draft_content_changed_at/);
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
    assert.match(lifecycle, /draft_content_changed_at/);
    assert.doesNotMatch(lifecycle, /proposal_pages|proposal_line_items|proposal_options/);
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    assert.doesNotMatch(tab, /bg-slate-50\/70/);
    assert.match(tab, /shouldRenderProposalAction/);
    assert.equal(fsExists("app/lib/proposalMutableDraftTouch.ts"), false);
  });
});

function fsExists(rel: string): boolean {
  try {
    read(rel);
    return true;
  } catch {
    return false;
  }
}
