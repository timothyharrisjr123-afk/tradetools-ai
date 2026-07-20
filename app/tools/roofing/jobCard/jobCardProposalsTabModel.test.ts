/**
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardProposalsTabModel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE,
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_EMPTY_BODY,
  JOB_CARD_PROPOSALS_EMPTY_TITLE,
  JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER,
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  buildJobCardProposalRowMetaLine,
  buildJobCardProposalRowView,
  buildJobCardProposalRowViews,
  formatJobCardContractorProposalStatusLabel,
  formatJobCardProposalRowTitle,
  formatJobCardProposalStatusLabel,
  formatJobCardProposalUpdatedShort,
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
    latest_sent_version_id: null,
    signed_version_id: null,
    created_at: null,
    updated_at: partial.updated_at ?? "2026-07-20T15:00:00.000Z",
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

  test("row title prefers title then template; package strengthens distinction", () => {
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
      "Roof replacement — Enhanced"
    );
    assert.equal(formatJobCardProposalRowTitle({ title: "", templateName: null }), "Proposal");
    assert.doesNotMatch(
      formatJobCardProposalRowTitle({ title: "Roof replacement" }),
      /Saved proposal/
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
        packageInTitle: true,
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
    assert.equal(row.title, "Roof Replacement — Standard");
    assert.match(row.metaLine, /^Draft · Updated/);
    assert.doesNotMatch(row.metaLine, /source template/i);
    assert.doesNotMatch(row.metaLine, /real-1/);
    assert.doesNotMatch(row.title, /smoke|RAW_PLUS/i);
  });

  test("job card status uses visible proposals only — smoke-only is create-ready", () => {
    const smokeOnly = filterContractorVisibleProposals([
      summary({ id: "1", title: "Coverage basis live smoke" }),
    ]);
    assert.equal(smokeOnly.length, 0);
    assert.equal(
      formatJobCardContractorProposalStatusLabel({ visibleSummaries: smokeOnly }),
      JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE
    );
    assert.doesNotMatch(
      formatJobCardContractorProposalStatusLabel({ visibleSummaries: smokeOnly }),
      /Proposal Draft/
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [summary({ id: "real", title: "Roof replacement", status: "draft" })],
      }),
      "Proposal Draft"
    );
  });
});
