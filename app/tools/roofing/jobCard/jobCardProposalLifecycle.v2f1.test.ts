/**
 * V2F1 — Job Card derived lifecycle + actions goldens.
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardProposalLifecycle.v2f1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import {
  JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE,
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CONTINUE_REVISION_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_EDIT_LABEL,
  JOB_CARD_PROPOSALS_PREVIEW_LABEL,
  JOB_CARD_PROPOSALS_PREVIEW_REVISION_LABEL,
  buildJobCardProposalActions,
  buildJobCardProposalRowView,
  buildJobCardProposalRowViews,
  formatJobCardContractorProposalStatusLabel,
} from "./jobCardProposalsTabModel";

const ROOT = process.cwd();
const SENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SIGNED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROPOSAL = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FROZEN = "2026-07-22T16:31:00.000Z";

function summary(
  partial: Partial<ProposalRecordStatusSummary> & { id: string }
): ProposalRecordStatusSummary {
  return {
    id: partial.id,
    job_id: partial.job_id ?? "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    status: partial.status ?? "draft",
    title: partial.title ?? "Roof replacement",
    proposal_number: null,
    template_id: partial.template_id ?? "tmpl-roof",
    selected_option_id: partial.selected_option_id ?? null,
    latest_sent_version_id: partial.latest_sent_version_id ?? null,
    signed_version_id: partial.signed_version_id ?? null,
    created_at: null,
    updated_at: partial.updated_at ?? FROZEN,
    draft_content_changed_at: partial.draft_content_changed_at ?? partial.updated_at ?? FROZEN,
  };
}

const hrefs = {
  builderHref: (id: string) => `/builder/${id}`,
  previewHref: (id: string) => `/preview/${id}`,
  sentRecordHref: (proposalId: string, versionId: string) =>
    `/preview/${proposalId}/sent/${versionId}`,
};

function visibleText(row: ReturnType<typeof buildJobCardProposalRowView>): string {
  return [
    row.title,
    row.metaLine,
    row.statusLabel,
    row.primaryAction.label,
    ...row.secondaryActions.map((action) => action.label),
    ...row.sentHistory.flatMap((entry) => [
      entry.sentAtLabel,
      entry.packageLabel ?? "",
      entry.deliveryStatusLabel ?? "",
    ]),
  ].join(" ");
}

describe("V2F1 Job Card six cases", () => {
  test("CASE 1 — no proposal", () => {
    assert.equal(
      formatJobCardContractorProposalStatusLabel({ visibleSummaries: [] }),
      JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE
    );
    assert.equal(JOB_CARD_PROPOSALS_CREATE_LABEL, "Create proposal");
    assert.equal(JOB_CARD_PROPOSALS_ADD_LABEL, "+ Proposal");
  });

  test("CASE 2 — draft only", () => {
    const row = buildJobCardProposalRowView({
      summary: summary({ id: PROPOSAL, status: "draft" }),
      packageLabel: "Standard",
      hrefs,
    });
    assert.equal(row.statusLabel, "Draft");
    assert.equal(row.lifecycleKind, "draft");
    assert.equal(row.primaryAction.id, "edit_proposal");
    assert.equal(row.primaryAction.label, JOB_CARD_PROPOSALS_EDIT_LABEL);
    assert.equal(row.primaryAction.enabled, true);
    assert.equal(row.secondaryActions[0]?.id, "preview");
    assert.equal(row.secondaryActions[0]?.label, JOB_CARD_PROPOSALS_PREVIEW_LABEL);
    assert.doesNotMatch(visibleText(row), /Open\b/);
  });

  test("CASE 3 — sent / no revision, header still draft", () => {
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: PROPOSAL,
        status: "draft",
        latest_sent_version_id: SENT_A,
        updated_at: FROZEN,
      }),
      packageLabel: "Enhanced",
      sentFacts: { latestSentFrozenAt: FROZEN, history: [] },
      hrefs,
    });
    assert.equal(row.statusLabel, "Sent");
    assert.equal(row.lifecycleKind, "sent");
    assert.match(row.metaLine, /Last sent/);
    assert.equal(row.primaryAction.id, "view_sent");
    assert.equal(row.primaryAction.label, "View sent proposal");
    assert.equal(row.primaryAction.enabled, true);
    assert.equal(row.primaryAction.href, `/preview/${PROPOSAL}/sent/${SENT_A}`);
    assert.equal(row.secondaryActions.map((action) => action.id).join(","), "revise_proposal");
    assert.equal(row.secondaryActions[0]?.href, `/builder/${PROPOSAL}`);
    assert.doesNotMatch(visibleText(row), /\bOpen\b/);
    assert.doesNotMatch(visibleText(row), /Needs attention/i);
  });

  test("CASE 4 — sent + revision in progress", () => {
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: PROPOSAL,
        status: "draft",
        latest_sent_version_id: SENT_A,
        updated_at: "2026-07-23T12:00:00.000Z",
      }),
      sentFacts: { latestSentFrozenAt: FROZEN },
      hrefs,
    });
    assert.equal(row.statusLabel, "Revision in progress");
    assert.equal(row.primaryAction.id, "continue_revision");
    assert.equal(row.primaryAction.label, JOB_CARD_PROPOSALS_CONTINUE_REVISION_LABEL);
    assert.equal(
      row.secondaryActions.map((action) => action.id).join(","),
      "preview_revision,view_last_sent"
    );
    assert.equal(row.secondaryActions[0]?.label, JOB_CARD_PROPOSALS_PREVIEW_REVISION_LABEL);
    assert.equal(row.secondaryActions[0]?.enabled, true);
    assert.equal(row.secondaryActions[1]?.label, "View last sent");
    assert.equal(row.secondaryActions[1]?.href, `/preview/${PROPOSAL}/sent/${SENT_A}`);
  });

  test("CASE 5 — one lineage row + history newest first + Current on latest_sent", () => {
    const rows = buildJobCardProposalRowViews({
      summaries: [
        summary({
          id: PROPOSAL,
          status: "draft",
          latest_sent_version_id: SENT_B,
          updated_at: FROZEN,
        }),
      ],
      sentFactsByProposalId: {
        [PROPOSAL]: {
          latestSentFrozenAt: FROZEN,
          history: [
            {
              versionId: SENT_B,
              sentAtLabel: "Jul 22, 4:31 PM",
              packageLabel: "Enhanced",
              deliveryStatusLabel: "Emailed",
              isCurrent: true,
            },
            {
              versionId: SENT_A,
              sentAtLabel: "Jul 1, 12:00 PM",
              packageLabel: "Standard",
              deliveryStatusLabel: "Delivered",
              isCurrent: false,
            },
          ],
        },
      },
      hrefs,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.sentHistory[0]?.isCurrent, true);
    assert.equal(rows[0]?.sentHistory[0]?.packageLabel, "Enhanced");
    assert.equal(rows[0]?.sentHistory[0]?.href, `/preview/${PROPOSAL}/sent/${SENT_B}`);
    assert.equal(rows[0]?.sentHistory[1]?.isCurrent, false);
    assert.equal(rows[0]?.sentHistory[1]?.href, `/preview/${PROPOSAL}/sent/${SENT_A}`);
    const text = visibleText(rows[0]!);
    assert.doesNotMatch(text, /aaaaaaaa-aaaa|bbbbbbbb-bbbb|composition_role|version_kind|superseded/i);
  });

  test("CASE 6 — request attention is not a lifecycle badge", () => {
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: PROPOSAL,
        status: "draft",
        latest_sent_version_id: SENT_A,
        updated_at: FROZEN,
      }),
      sentFacts: { latestSentFrozenAt: FROZEN },
      hrefs,
    });
    assert.equal(row.statusLabel, "Sent");
    assert.doesNotMatch(row.statusLabel, /attention|request/i);
    assert.doesNotMatch(row.metaLine, /Needs attention/i);
  });

  test("signed pointer does not enable revise/edit/continue", () => {
    const actions = buildJobCardProposalActions({
      kind: "signed",
      editingAllowed: false,
      builderHref: "/builder/x",
      previewHref: "/preview/x",
      sentRecordHref: "/preview/sent",
    });
    assert.equal(actions.primaryAction.id, "view_sent");
    assert.equal(actions.primaryAction.enabled, true);
    assert.equal(actions.primaryAction.href, "/preview/sent");
    assert.equal(actions.secondaryActions.length, 0);
    const row = buildJobCardProposalRowView({
      summary: summary({
        id: PROPOSAL,
        latest_sent_version_id: SENT_A,
        signed_version_id: SIGNED,
        updated_at: "2026-08-01T00:00:00.000Z",
      }),
      sentFacts: { latestSentFrozenAt: FROZEN },
      hrefs,
    });
    assert.equal(row.lifecycleKind, "signed");
    assert.equal(row.statusLabel, "Sent");
    assert.equal(row.primaryAction.enabled, true);
    assert.equal(row.primaryAction.href, `/preview/${PROPOSAL}/sent/${SIGNED}`);
    assert.equal(row.secondaryActions.length, 0);
  });

  test("+ Proposal remains a separate add-lineage control", () => {
    assert.equal(JOB_CARD_PROPOSALS_ADD_LABEL, "+ Proposal");
    const tab = readFileSync(join(ROOT, "app/tools/roofing/jobCard/JobCardProposalsTab.tsx"), "utf8");
    const client = readFileSync(join(ROOT, "app/tools/roofing/jobCard/JobCardClient.tsx"), "utf8");
    assert.match(tab, /data-jobcard-add-proposal/);
    assert.doesNotMatch(tab, /revise.*createNewProposalDraftEntry/i);
    assert.match(tab, /data-jobcard-proposal-current/);
    assert.match(tab, /data-jobcard-proposal-earlier/);
    assert.match(tab, /formatJobCardEarlierProposalsHeading/);
    assert.match(tab, /JOB_CARD_PROPOSALS_SHOW_EARLIER_LABEL/);
    assert.match(tab, /data-jobcard-proposal-earlier-toggle/);
    assert.match(tab, /<details[\s\S]*data-jobcard-proposal-earlier/);
    assert.doesNotMatch(tab, /data-jobcard-proposal-earlier[\s\S]*open=/);
    assert.match(client, /quiet=\{jobCardProposalRows\.length > 0\}/);
    assert.match(client, /activeProposalId: hydratedJobRecord\?\.active_proposal_id/);
  });
});

describe("V2F1 negatives", () => {
  test("Job Card / lifecycle sources do not write status, stage, events, freeze, or tokens", () => {
    const files = [
      "app/lib/proposalContractorLifecycle.ts",
      "app/lib/proposalJobCardSentHistory.ts",
      "app/lib/proposalJobCardLifecycleRead.ts",
      "app/tools/roofing/jobCard/jobCardProposalsTabModel.ts",
      "app/tools/roofing/jobCard/JobCardProposalsTab.tsx",
    ];
    for (const rel of files) {
      const source = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(source, /jobs\.stage\s*=/);
      assert.doesNotMatch(source, /\.update\(\s*\{\s*status:/);
      assert.doesNotMatch(source, /proposal_events/);
      assert.doesNotMatch(source, /event_type:\s*"sent"|event_type:\s*"revised"/);
      assert.doesNotMatch(source, /persist_proposal_send_freeze/);
      assert.doesNotMatch(source, /mint_proposal_public_access_token/);
    }
  });

  test("RoofingClient Job Card wiring does not generic-Open sent proposals into Builder", () => {
    const client = readFileSync(join(ROOT, "app/tools/roofing/RoofingClient.tsx"), "utf8");
    const start = client.indexOf("<JobCardProposalsTab");
    const end = client.indexOf("/>", start);
    const tab = client.slice(start, end);
    assert.match(tab, /onProposalAction/);
    assert.doesNotMatch(tab, /onOpenProposal/);
    assert.match(client, /loadJobCardProposalSentFacts/);
    assert.doesNotMatch(client, /event_type:\s*"sent"/);
    assert.doesNotMatch(client, /event_type:\s*"revised"/);
  });

  test("Jobs Board lane helpers stay untouched by V2F1 lifecycle imports", () => {
    const board = readFileSync(join(ROOT, "app/tools/roofing/saved/jobsBoardUtils.ts"), "utf8");
    assert.doesNotMatch(board, /proposalContractorLifecycle/);
    assert.doesNotMatch(board, /loadJobCardProposalSentFacts/);
    assert.doesNotMatch(board, /Revision in progress/);
  });

  test("freeze RPC file is not imported from V2F1 Job Card files", () => {
    const tab = readFileSync(join(ROOT, "app/tools/roofing/jobCard/JobCardProposalsTab.tsx"), "utf8");
    const model = readFileSync(
      join(ROOT, "app/tools/roofing/jobCard/jobCardProposalsTabModel.ts"),
      "utf8"
    );
    assert.doesNotMatch(tab, /proposalSendFreeze|persist_proposal_send_freeze/);
    assert.doesNotMatch(model, /proposalSendFreeze|persist_proposal_send_freeze/);
  });
});
