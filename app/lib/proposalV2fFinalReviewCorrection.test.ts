/**
 * V2F final review correction — coherent fixture/presenter ownership.
 * Run: npx tsx --test app/lib/proposalV2fFinalReviewCorrection.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import { resolveProposalCustomerPreviewSelectedTotalLabel } from "@/app/lib/proposalCustomerPreviewViewModel";
import { formatPriceCents } from "@/app/tools/roofing/proposals/builder/proposalBuilderConstants";
import { deriveProposalSendFreezeReadiness } from "@/app/lib/proposalSendFreezeReadiness";
import {
  buildProposalSendGateReadinessViewModel,
  resolveSendGateRecipientEmail,
  resolveSendGateSheetTitle,
  SEND_GATE_SEND_PROPOSAL_LABEL,
  SEND_GATE_SEND_REVISION_LABEL,
} from "@/app/lib/proposalSendGateReadiness";
import { buildJobCardSentHistoryView } from "@/app/lib/proposalJobCardSentHistory";
import { buildProposalPreviewSentRecordChrome } from "@/app/lib/proposalPreviewSentRecord";
import {
  V2F_REVIEW_DRAFT_UPDATED_AT,
  V2F_REVIEW_DRAFT_VERSION_ID,
  V2F_REVIEW_SENT_A,
  V2F_REVIEW_SENT_A_FROZEN_AT,
  V2F_REVIEW_SENT_B,
  V2F_REVIEW_SENT_B_FROZEN_AT,
  asRevisionPreviewDraftGraph,
  v2fReviewJobCardSentVersions,
  v2fReviewSentVersionGraph,
} from "@/app/lib/proposalV2fCompleteReviewFixtures";
import { buildJobCardProposalRowView } from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";

const ROOT = process.cwd();

function revisionDraftGraph() {
  return asRevisionPreviewDraftGraph(v2fReviewSentVersionGraph(V2F_REVIEW_SENT_B), {
    latestSentVersionId: V2F_REVIEW_SENT_A,
    draftUpdatedAt: V2F_REVIEW_DRAFT_UPDATED_AT,
  });
}

function summary(latestSentVersionId: string, updatedAt: string): ProposalRecordStatusSummary {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    job_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    status: "draft",
    title: "Roof replacement",
    proposal_number: null,
    template_id: "tmpl-roof",
    selected_option_id: null,
    latest_sent_version_id: latestSentVersionId,
    signed_version_id: null,
    created_at: null,
    updated_at: updatedAt,
  };
}

describe("V2F send revision graph ownership", () => {
  test("revision Preview graph id == proposal.current_draft_version_id", () => {
    const graph = revisionDraftGraph();
    assert.equal(graph.version.id, graph.proposal.current_draft_version_id);
    assert.equal(graph.version.version_kind, "draft");
    assert.equal(graph.version.frozen_at, null);
  });

  test("legitimate revision has no graph mismatch and Send revision is enabled", () => {
    const graph = revisionDraftGraph();
    const freeze = deriveProposalSendFreezeReadiness({ graph, pricingStale: false });
    assert.equal(
      freeze.blockingReasons.includes(
        "Graph version does not match proposal current_draft_version_id."
      ),
      false
    );
    assert.equal(freeze.ready, true);
    const document = buildProposalCustomerPreviewDocument(graph, {
      pricingStale: { stale: false, reason: null },
    });
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: freeze,
      previewReadiness: document.readiness,
      recipientEmail: resolveSendGateRecipientEmail({ graph, job: null }),
      customerFirstName: "Jordan",
      companyName: "Summit Roofing",
      projectAddress: "1842 E 31st St, Tulsa, OK",
      emailDeliveryConfigured: true,
    });
    assert.equal(vm.canSend, true);
    assert.equal(resolveSendGateSheetTitle(true), SEND_GATE_SEND_REVISION_LABEL);
  });

  test("invalid mismatched graph still BLOCKS send", () => {
    const graph = revisionDraftGraph();
    graph.proposal.current_draft_version_id = V2F_REVIEW_DRAFT_VERSION_ID;
    const freeze = deriveProposalSendFreezeReadiness({ graph, pricingStale: false });
    assert.equal(graph.version.id === graph.proposal.current_draft_version_id, false);
    assert.match(
      freeze.blockingReasons.join(" "),
      /Graph version does not match proposal current_draft_version_id/
    );
    assert.equal(freeze.ready, false);
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: freeze,
      previewReadiness: { blockingLineCount: 0, pricingComplete: true, warnings: [] },
      recipientEmail: "jordan@example.com",
      customerFirstName: "Jordan",
      companyName: "Summit Roofing",
      projectAddress: null,
      emailDeliveryConfigured: true,
    });
    assert.equal(vm.canSend, false);
  });

  test("initial send title = Send proposal; revision send title = Send revision", () => {
    assert.equal(resolveSendGateSheetTitle(false), SEND_GATE_SEND_PROPOSAL_LABEL);
    assert.equal(resolveSendGateSheetTitle(true), SEND_GATE_SEND_REVISION_LABEL);
    const drawer = readFileSync(
      join(ROOT, "app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendSharingDrawer.tsx"),
      "utf8"
    );
    assert.match(drawer, /resolveSendGateSheetTitle\(isRevisionSend\)/);
    const freeze = readFileSync(join(ROOT, "app/lib/proposalSendFreezeReadiness.ts"), "utf8");
    assert.match(freeze, /Graph version does not match proposal current_draft_version_id/);
  });
});

describe("V2F sent-record chrome ownership", () => {
  test("selected exact frozen version owns header package, total, and timestamp", () => {
    const graph = v2fReviewSentVersionGraph(V2F_REVIEW_SENT_B);
    const document = buildProposalCustomerPreviewDocument(graph, {
      pricingStale: { stale: false, reason: null },
    });
    const estimatePage = document.pages.find((page) => page.kind === "estimate");
    assert.equal(estimatePage?.kind, "estimate");
    const selected = graph.options.find(
      (option) => option.id === graph.proposal.selected_option_id
    );
    assert.ok(selected);
    assert.ok(selected.customer_total_cents != null);
    const selectedTotalCents = selected.customer_total_cents;
    const headerTotal = resolveProposalCustomerPreviewSelectedTotalLabel(graph);
    assert.equal(headerTotal, formatPriceCents(selectedTotalCents));
    assert.equal(
      estimatePage && estimatePage.kind === "estimate"
        ? estimatePage.optionPreview?.customer.customerTotalCents
        : null,
      selectedTotalCents
    );
    assert.equal(
      estimatePage && estimatePage.kind === "estimate" ? estimatePage.selectedOptionLabel : null,
      selected.customer_label
    );
    const chrome = buildProposalPreviewSentRecordChrome({
      frozenAt: graph.version.frozen_at,
      deliveryLabel: "Emailed",
    });
    assert.equal(graph.version.id, V2F_REVIEW_SENT_B);
    assert.equal(graph.version.frozen_at, V2F_REVIEW_SENT_B_FROZEN_AT);
    assert.ok(chrome.sentAtLabel);
  });

  test("historical selected version does not mix latest values", () => {
    const historical = v2fReviewSentVersionGraph(V2F_REVIEW_SENT_A);
    const latest = v2fReviewSentVersionGraph(V2F_REVIEW_SENT_B);
    const historicalTotal = resolveProposalCustomerPreviewSelectedTotalLabel(historical);
    const latestTotal = resolveProposalCustomerPreviewSelectedTotalLabel(latest);
    assert.notEqual(historicalTotal, latestTotal);
    assert.equal(historicalTotal, "$18,450.00");
    assert.equal(latestTotal, "$20,175.00");
    const historicalDoc = buildProposalCustomerPreviewDocument(historical, {
      pricingStale: { stale: false, reason: null },
    });
    const estimatePage = historicalDoc.pages.find((page) => page.kind === "estimate");
    assert.equal(
      estimatePage && estimatePage.kind === "estimate" ? estimatePage.selectedOptionLabel : null,
      "Standard"
    );
    assert.equal(historical.version.id, V2F_REVIEW_SENT_A);
    assert.equal(historical.version.frozen_at, V2F_REVIEW_SENT_A_FROZEN_AT);
    assert.equal(historical.proposal.latest_sent_version_id, V2F_REVIEW_SENT_B);
  });
});

describe("V2F Job Card last-sent timestamp ownership", () => {
  test("Last sent timestamp == CURRENT history row for latest_sent_version_id", () => {
    const versions = v2fReviewJobCardSentVersions();
    const history = buildJobCardSentHistoryView({
      latestSentVersionId: V2F_REVIEW_SENT_B,
      versions,
    });
    const current = history.rows.find((row) => row.isCurrent);
    assert.equal(history.latestSentFrozenAt, V2F_REVIEW_SENT_B_FROZEN_AT);
    assert.equal(current?.versionId, V2F_REVIEW_SENT_B);
    const row = buildJobCardProposalRowView({
      summary: summary(V2F_REVIEW_SENT_B, V2F_REVIEW_SENT_B_FROZEN_AT),
      packageLabel: "Enhanced",
      sentFacts: {
        latestSentFrozenAt: history.latestSentFrozenAt,
        history: history.rows,
      },
    });
    assert.equal(row.lastSentAtLabel, current?.sentAtLabel);
    assert.equal(
      row.sentHistory.find((entry) => entry.isCurrent)?.versionId,
      V2F_REVIEW_SENT_B
    );
  });
});
