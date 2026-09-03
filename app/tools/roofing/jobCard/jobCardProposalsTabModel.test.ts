/**
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardProposalsTabModel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOB_CARD_PROPOSAL_STATUS_READY_TO_PREPARE,
  JOB_CARD_PROPOSAL_STATUS_EXISTS,
  JOB_CARD_PROPOSAL_STATUS_UNAVAILABLE,
  formatBoardProposalPresenceLabel,
  hasCanonicalJobProposalPointer,
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_EMPTY_BODY,
  JOB_CARD_PROPOSALS_EMPTY_TITLE,
  JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER,
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  buildJobCardProposalRowMetaLine,
  buildJobCardProposalRowView,
  buildJobCardProposalRowViews,
  formatJobCardEarlierProposalsHeading,
  formatJobCardContractorProposalStatusLabel,
  formatJobCardProposalCreatedActivityNote,
  formatJobCardProposalCustomerStateLabel,
  formatJobCardProposalRowPackageBadge,
  formatJobCardProposalRowTitle,
  formatJobCardProposalStatusLabel,
  formatJobCardProposalUpdatedShort,
  partitionJobCardProposalRows,
  JOB_CARD_PROPOSAL_ACTIVITY_CREATED_LABEL,
  JOB_CARD_PROPOSAL_ACTIVITY_CREATED_NOTE,
} from "./jobCardProposalsTabModel";
import { filterContractorVisibleProposals } from "@/app/lib/contractorFixtureIsolation";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";

function summary(
  partial: Partial<ProposalRecordStatusSummary> & { id: string; title?: string | null }
): ProposalRecordStatusSummary {
  return {
    id: partial.id,
    job_id: partial.job_id ?? "job-1",
    status: partial.status ?? "draft",
    title: partial.title ?? null,
    proposal_number: null,
    template_id: partial.template_id ?? "tmpl-roof",
    selected_option_id: partial.selected_option_id ?? null,
    latest_sent_version_id: partial.latest_sent_version_id ?? null,
    signed_version_id: partial.signed_version_id ?? null,
    created_at: null,
    updated_at: partial.updated_at ?? "2026-07-20T15:00:00.000Z",
    draft_content_changed_at:
      partial.draft_content_changed_at ??
      partial.updated_at ??
      "2026-07-20T15:00:00.000Z",
  };
}

describe("jobCardProposalsTab helpers", () => {
  test("approved copy constants", () => {
    assert.equal(JOB_CARD_PROPOSALS_ADD_LABEL, "+ Proposal");
    assert.equal(JOB_CARD_PROPOSALS_CREATE_LABEL, "Create proposal");
    assert.equal(JOB_CARD_PROPOSALS_EMPTY_TITLE, "No proposals yet");
    assert.match(JOB_CARD_PROPOSALS_EMPTY_BODY, /measurement report/i);
    assert.match(JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER, /measurement.*template.*package/i);
    assert.match(JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS, /bg-blue-600/);
    assert.doesNotMatch(JOB_CARD_PROPOSALS_ADD_LABEL, /draft/i);
    assert.doesNotMatch(JOB_CARD_PROPOSALS_CREATE_LABEL, /draft/i);
  });

  test("row title prefers title then template; package is a badge not title text", () => {
    assert.equal(
      formatJobCardProposalRowTitle({ title: "Roof Replacement Proposal" }),
      "Roof Replacement Proposal"
    );
    assert.equal(
      formatJobCardProposalRowTitle({ title: null, templateName: "Roof replacement" }),
      "Roof replacement"
    );
    assert.equal(
      formatJobCardProposalRowTitle({
        title: "Roof replacement",
        packageLabel: "Enhanced",
      }),
      "Roof replacement"
    );
    assert.equal(formatJobCardProposalRowPackageBadge("Enhanced package"), "Enhanced");
    assert.equal(formatJobCardProposalRowTitle({ title: "", templateName: null }), "Proposal");
    assert.doesNotMatch(
      formatJobCardProposalRowTitle({ title: "Roof replacement", packageLabel: "Enhanced" }),
      /—|Enhanced/
    );
  });

  test("status and meta line stay compact", () => {
    assert.equal(formatJobCardProposalStatusLabel("draft"), "Draft");
    assert.equal(formatJobCardProposalStatusLabel("sent"), "Sent");
    assert.equal(
      formatJobCardProposalUpdatedShort("2026-07-20T15:00:00.000Z"),
      new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date("2026-07-20T15:00:00.000Z")
      )
    );
    assert.match(
      buildJobCardProposalRowMetaLine({
        packageLabel: "Standard",
        statusLabel: "Draft",
        updatedLabel: "Jul 20",
      }),
      /Standard package · Draft · Updated Jul 20/
    );
    assert.match(
      buildJobCardProposalRowMetaLine({
        packageLabel: "Standard",
        statusLabel: "Draft",
        updatedLabel: "Jul 20",
        packageAsBadge: true,
      }),
      /^Draft · Updated Jul 20$/
    );
  });

  test("smoke-only proposals yield empty contractor row list", () => {
    const rows = filterContractorVisibleProposals([
      summary({ id: "1", title: "Coverage basis live smoke" }),
      summary({ id: "2", title: "RAW_PLUS_WASTE draft" }),
    ]);
    assert.equal(rows.length, 0);
    assert.equal(buildJobCardProposalRowViews({ summaries: rows }).length, 0);
  });

  test("real proposals become compact rows without source template/ids in meta", () => {
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: "real-1",
        title: "Roof Replacement Proposal",
        selected_option_id: "opt-1",
      }),
      packageLabel: "Standard",
      templateName: "Roof replacement",
    });
    assert.equal(row.title, "Roof Replacement");
    assert.equal(row.packageLabel, "Standard");
    assert.match(row.metaLine, /^Draft · Updated/);
    assert.doesNotMatch(row.metaLine, /source template/i);
    assert.doesNotMatch(row.metaLine, /real-1/);
    assert.doesNotMatch(row.title, /smoke|RAW_PLUS|—/i);
  });

  test("job card status uses visible proposals only — smoke-only is create-ready", () => {
    const smokeOnly = filterContractorVisibleProposals([
      summary({ id: "1", title: "Coverage basis live smoke" }),
    ]);
    assert.equal(smokeOnly.length, 0);
    assert.equal(
      formatJobCardContractorProposalStatusLabel({ visibleSummaries: smokeOnly }),
      JOB_CARD_PROPOSAL_STATUS_READY_TO_PREPARE
    );
    assert.doesNotMatch(
      formatJobCardContractorProposalStatusLabel({ visibleSummaries: smokeOnly }),
      /Proposal Draft/
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [summary({ id: "real", title: "Roof replacement", status: "draft" })],
      }),
      "Draft proposal"
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [
          summary({
            id: "a",
            title: "Roof replacement",
            status: "draft",
            updated_at: "2026-07-20T10:00:00.000Z",
          }),
          summary({
            id: "b",
            title: "Roof replacement",
            status: "draft",
            updated_at: "2026-07-20T16:00:00.000Z",
          }),
        ],
        packageLabelsByProposalId: { a: "Standard", b: "Enhanced" },
      }),
      "Latest: Enhanced · Draft"
    );
  });

  test("pointer exists + empty visible summaries is Proposal, not Ready to create", () => {
    const pointer = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    assert.equal(hasCanonicalJobProposalPointer({ activeProposalId: pointer }), true);
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        activeProposalId: pointer,
      }),
      JOB_CARD_PROPOSAL_STATUS_EXISTS
    );
    assert.notEqual(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        activeProposalId: pointer,
      }),
      JOB_CARD_PROPOSAL_STATUS_READY_TO_PREPARE
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        latestProposalId: pointer,
        acceptedProposalIds: { [pointer]: true },
      }),
      "Accepted"
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        activeProposalId: pointer,
        acceptedProposalIds: { [pointer]: true },
        signedProposalIds: { [pointer]: true },
      }),
      "Signed"
    );
  });

  test("Scheduled/Production real ancestry shows Accepted when summary visible", () => {
    const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const sent = summary({
      id,
      title: "Roof replacement",
      status: "draft",
      latest_sent_version_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const facts = { latestSentFrozenAt: "2026-08-16T12:00:00.000Z", history: [] };
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [sent],
        sentFactsByProposalId: { [id]: facts },
        acceptedProposalIds: { [id]: true },
        activeProposalId: id,
      }),
      "Accepted"
    );
  });

  test("invalid advanced fixture with no proposal is stage-aware", () => {
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        activeProposalId: null,
        latestProposalId: null,
        stage: "intake",
      }),
      JOB_CARD_PROPOSAL_STATUS_READY_TO_PREPARE
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        activeProposalId: null,
        latestProposalId: null,
        stage: "scheduled",
      }),
      JOB_CARD_PROPOSAL_STATUS_UNAVAILABLE
    );
    assert.equal(formatBoardProposalPresenceLabel(false, "intake"), "No Proposal");
    assert.equal(
      formatBoardProposalPresenceLabel(false, "scheduled"),
      "Proposal unavailable"
    );
    assert.equal(formatBoardProposalPresenceLabel(true), "Proposal");
  });

  test("Accepted and Signed share one status owner for strip and row", () => {
    const sent = summary({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      title: "Roof replacement",
      status: "draft",
      latest_sent_version_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      updated_at: "2026-08-16T12:00:00.000Z",
    });
    const facts = {
      latestSentFrozenAt: "2026-08-16T12:00:00.000Z",
      history: [],
    };
    const acceptedRow = buildJobCardProposalRowView({
      summary: sent,
      sentFacts: facts,
      customerAccepted: true,
    });
    const signedRow = buildJobCardProposalRowView({
      summary: sent,
      sentFacts: facts,
      customerAccepted: true,
      customerSigned: true,
    });
    assert.equal(acceptedRow.statusLabel, "Accepted");
    assert.equal(signedRow.statusLabel, "Signed");
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [sent],
        sentFactsByProposalId: { [sent.id]: facts },
        acceptedProposalIds: { [sent.id]: true },
      }),
      "Accepted"
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [sent],
        sentFactsByProposalId: { [sent.id]: facts },
        acceptedProposalIds: { [sent.id]: true },
        signedProposalIds: { [sent.id]: true },
      }),
      "Signed"
    );
    assert.notEqual(acceptedRow.statusLabel, "Sent");
    assert.equal(
      formatJobCardProposalCustomerStateLabel({
        lifecycle: {
          kind: "sent",
          statusLabel: "Sent",
          editingAllowed: false,
          hasLatestSentVersion: true,
          isDraftDirtyAfterLatestSent: false,
        },
        customerAccepted: true,
      }),
      "Accepted"
    );
  });

  test("created activity copy is contractor-facing", () => {
    assert.equal(JOB_CARD_PROPOSAL_ACTIVITY_CREATED_LABEL, "Proposal created");
    assert.equal(
      JOB_CARD_PROPOSAL_ACTIVITY_CREATED_NOTE,
      "Open Builder to review this proposal."
    );
    assert.equal(
      formatJobCardProposalCreatedActivityNote("Enhanced"),
      "Enhanced proposal ready to review"
    );
    assert.doesNotMatch(
      formatJobCardProposalCreatedActivityNote("Enhanced"),
      /Proposal Builder ready/i
    );
  });

  test("canonical active pointer is current; timestamps do not invent current", () => {
    const older = summary({
      id: "a",
      title: "Roof replacement",
      status: "draft",
      updated_at: "2026-07-20T10:00:00.000Z",
    });
    const newer = summary({
      id: "b",
      title: "Roof replacement",
      status: "draft",
      updated_at: "2026-07-20T16:00:00.000Z",
    });
    const rows = buildJobCardProposalRowViews({
      summaries: [newer, older],
      packageLabelsByProposalId: { a: "Standard", b: "Enhanced" },
      activeProposalId: "a",
    });
    assert.equal(rows[0]?.proposalId, "a");
    assert.equal(rows[0]?.isCurrent, true);
    assert.equal(rows[1]?.proposalId, "b");
    assert.equal(rows[1]?.isCurrent, false);
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [older, newer],
        packageLabelsByProposalId: { a: "Standard", b: "Enhanced" },
        activeProposalId: "a",
      }),
      "Standard · Draft"
    );
    const unsorted = buildJobCardProposalRowViews({
      summaries: [newer, older],
      packageLabelsByProposalId: { a: "Standard", b: "Enhanced" },
    });
    assert.equal(unsorted.every((row) => row.isCurrent === false), true);
    assert.equal(unsorted[0]?.proposalId, "b");
  });

  test("earlier proposals heading uses live count; partition keeps current out of history", () => {
    assert.equal(formatJobCardEarlierProposalsHeading(7), "Earlier proposals · 7");
    assert.equal(formatJobCardEarlierProposalsHeading(1), "Earlier proposals · 1");
    assert.equal(formatJobCardEarlierProposalsHeading(0), "Earlier proposals · 0");
    const rows = buildJobCardProposalRowViews({
      summaries: [
        summary({ id: "cur", title: "Roof replacement", updated_at: "2026-07-20T09:00:00.000Z" }),
        summary({ id: "old-1", title: "Roof replacement", updated_at: "2026-07-20T16:00:00.000Z" }),
        summary({ id: "old-2", title: "Roof replacement", updated_at: "2026-07-20T15:00:00.000Z" }),
      ],
      activeProposalId: "cur",
    });
    const { current, earlier } = partitionJobCardProposalRows(rows);
    assert.equal(current?.proposalId, "cur");
    assert.equal(current?.isCurrent, true);
    assert.equal(earlier.length, 2);
    assert.equal(
      earlier.every((row) => row.isCurrent === false),
      true
    );
    assert.equal(formatJobCardEarlierProposalsHeading(earlier.length), "Earlier proposals · 2");
    assert.doesNotMatch(
      earlier.map((row) => row.proposalId).join(","),
      /cur/
    );
  });
});
