/**
 * R3B4B — attention read model and UI integration contracts.
 *
 * Run:
 * npx tsx --test app/lib/jobAttentionReadModel.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildJobCardAttentionHref,
  compareJobAttentionPriority,
  normalizeAttentionMessagePreview,
  selectActiveAttention,
  summarizeActiveAttentionByJob,
  type JobAttentionPriorityItem,
  type JobAttentionSafeItem,
} from "./jobAttentionReadModel";

const JOB_A = "11111111-1111-4111-8111-111111111111";
const JOB_B = "22222222-2222-4222-8222-222222222222";
const ATTENTION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATTENTION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ATTENTION_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";

function item(
  overrides: Partial<JobAttentionSafeItem> = {}
): JobAttentionSafeItem {
  const id = overrides.id ?? ATTENTION_A;
  const sourceId = overrides.sourceId ?? REQUEST_ID;
  return {
    id,
    jobId: JOB_A,
    proposalId: PROPOSAL_ID,
    proposalVersionId: VERSION_ID,
    attentionType: "customer_package_request",
    sourceType: "proposal_customer_requests",
    sourceId,
    status: "open",
    severity: "high",
    openedAt: "2026-07-20T12:00:00.000Z",
    acknowledgedAt: null,
    destination: {
      kind: "job_card_proposals",
      proposalId: PROPOSAL_ID,
      proposalVersionId: VERSION_ID,
      requestId: sourceId,
      tab: "proposals",
      anchor: "customer_request",
    },
    request: {
      requestId: sourceId,
      intent: "request_package",
      requestStatus: "new",
      packageLabel: "Premium",
      message: "Please call before visiting.",
      messagePreview: "Please call before visiting.",
      customerName: "Customer",
      customerEmail: "customer@example.com",
      customerPhone: "555-0100",
    },
    personalReadAt: null,
    personalLastViewedAt: null,
    ...overrides,
  };
}

describe("R3B4B attention priority and aggregation", () => {
  test("orders critical before high before normal", () => {
    const values = [
      item({ id: ATTENTION_A, severity: "normal" }),
      item({ id: ATTENTION_B, severity: "critical" }),
      item({ id: ATTENTION_C, severity: "high" }),
    ].sort(compareJobAttentionPriority);
    assert.deepEqual(
      values.map((value) => value.severity),
      ["critical", "high", "normal"]
    );
  });

  test("orders open before acknowledged, then oldest opened_at", () => {
    const values = [
      item({
        id: ATTENTION_A,
        status: "acknowledged",
        openedAt: "2026-07-18T12:00:00.000Z",
      }),
      item({
        id: ATTENTION_B,
        status: "open",
        openedAt: "2026-07-21T12:00:00.000Z",
      }),
      item({
        id: ATTENTION_C,
        status: "open",
        openedAt: "2026-07-19T12:00:00.000Z",
      }),
    ].sort(compareJobAttentionPriority);
    assert.deepEqual(
      values.map((value) => value.id),
      [ATTENTION_C, ATTENTION_B, ATTENTION_A]
    );
  });

  test("keeps acknowledged active and excludes resolved from summaries", () => {
    const resolved = {
      ...item({ id: ATTENTION_C }),
      status: "resolved",
    } as unknown as JobAttentionPriorityItem;
    const summaries = summarizeActiveAttentionByJob([
      item({ id: ATTENTION_A, status: "open" }),
      item({ id: ATTENTION_B, status: "acknowledged" }),
      resolved,
    ]);
    assert.equal(summaries[JOB_A]?.activeCount, 2);
    assert.equal(summaries[JOB_A]?.primaryAttentionId, ATTENTION_A);
    assert.equal(summaries[JOB_A]?.label, "Customer request +1");
  });

  test("uses one primary summary per job without mixing jobs", () => {
    const summaries = summarizeActiveAttentionByJob([
      item({ id: ATTENTION_A }),
      item({
        id: ATTENTION_B,
        jobId: JOB_B,
        attentionType: "customer_question",
        severity: "critical",
      }),
    ]);
    assert.deepEqual(Object.keys(summaries).sort(), [JOB_A, JOB_B].sort());
    assert.equal(summaries[JOB_B]?.label, "Customer question");
  });

  test("falls back to highest-priority active item for an unrelated id", () => {
    const selected = selectActiveAttention(
      [
        item({ id: ATTENTION_A, severity: "normal" }),
        item({ id: ATTENTION_B, severity: "critical" }),
      ],
      ATTENTION_C
    );
    assert.equal(selected?.id, ATTENTION_B);
  });

  test("advances after dismissal and removes the surface after the final item", () => {
    const initial = [
      item({ id: ATTENTION_A, severity: "critical" }),
      item({ id: ATTENTION_B, severity: "high" }),
    ];
    assert.equal(selectActiveAttention(initial)?.id, ATTENTION_A);
    assert.equal(
      selectActiveAttention(
        initial.filter((value) => value.id !== ATTENTION_A)
      )?.id,
      ATTENTION_B
    );
    assert.equal(selectActiveAttention([]), null);
  });
});

describe("R3B4B safe presentation and navigation", () => {
  test("normalizes whitespace and caps message previews", () => {
    const preview = normalizeAttentionMessagePreview(
      "  Hello \n\n customer\t" + "x".repeat(300),
      60
    );
    assert.ok(preview);
    assert.equal(preview.length, 60);
    assert.equal(preview.includes("\n"), false);
    assert.equal(preview.includes("\t"), false);
    assert.equal(preview.endsWith("…"), true);
  });

  test("builds one normal Job Card target with attention context", () => {
    assert.equal(
      buildJobCardAttentionHref(JOB_A, ATTENTION_A),
      `/tools/roofing?entry=job-card&job=${JOB_A}&attention=${ATTENTION_A}`
    );
  });
});

describe("R3B4B integration guardrails", () => {
  const root = process.cwd();
  const persistence = readFileSync(
    join(root, "app/lib/jobAttentionReadPersistence.ts"),
    "utf8"
  );
  const route = readFileSync(
    join(root, "app/api/jobs/attention/route.ts"),
    "utf8"
  );
  const hook = readFileSync(join(root, "app/lib/useJobAttention.ts"), "utf8");
  const board = readFileSync(
    join(root, "app/tools/roofing/saved/SavedClient.tsx"),
    "utf8"
  );
  const boardModel = readFileSync(
    join(root, "app/tools/roofing/saved/jobsBoardUtils.ts"),
    "utf8"
  );
  const boardCard = readFileSync(
    join(root, "app/tools/roofing/saved/components/JobsBoardCard.tsx"),
    "utf8"
  );
  const listView = readFileSync(
    join(root, "app/tools/roofing/saved/components/JobsBoardListView.tsx"),
    "utf8"
  );
  const proposals = readFileSync(
    join(root, "app/tools/roofing/jobCard/JobCardProposalsTab.tsx"),
    "utf8"
  );
  const nextAction = readFileSync(
    join(root, "app/tools/roofing/jobCard/JobCardNextActionPanel.tsx"),
    "utf8"
  );

  test("uses one company summary hook, not one request per board card", () => {
    assert.equal(
      (board.match(/useJobAttentionSummaries\(/g) ?? []).length,
      1
    );
    assert.equal(board.includes("fetchJobAttentionDetail("), false);
    assert.match(persistence, /\.range\(offset, end\)/);
    assert.match(persistence, /JOB_ATTENTION_SUMMARY_MAX_ROWS = 5000/);
  });

  test("scopes detail by company, job, active status, and exact read target", () => {
    assert.match(persistence, /\.eq\("company_id", input\.companyId\)/);
    assert.match(persistence, /\.eq\("job_id", input\.jobId\)/);
    assert.match(
      persistence,
      /\.in\("status", \["open", "acknowledged"\]\)/
    );
    assert.match(route, /requestedAttentionId/);
    assert.match(route, /return notFound\(\)/);
  });

  test("treats the shared event as re-fetch invalidation only", () => {
    assert.match(hook, /JOB_ATTENTION_CHANGED_EVENT/);
    assert.match(hook, /void reload\(\)/);
    assert.equal(hook.includes("localStorage"), false);
    assert.equal(hook.includes("event.detail.summaries"), false);
  });

  test("keeps attention separate from Tasks and preserves board sorting", () => {
    assert.match(boardModel, /function deriveTasksLabel/);
    assert.match(boardModel, /attention\?: JobAttentionSummary \| null/);
    assert.equal(boardCard.includes("ListChecks"), true);
    assert.equal(boardCard.includes("CircleAlert"), true);
    assert.match(board, /sortJobsForBoardColumn\(boardVisibleJobs, boardSortKey/);
    assert.equal(board.includes("sortJobsForBoardColumn(attention"), false);
  });

  test("provides board and list-view attention parity", () => {
    assert.match(boardCard, /data-jobs-board-attention/);
    assert.match(listView, /data-jobs-list-attention/);
    assert.match(listView, /model\.attention\.accessibleLabel/);
  });

  test("does not auto-mark read during ordinary detail loading", () => {
    assert.equal(hook.includes("markDisplayedJobAttentionRead(jobId"), true);
    const initialLoad = hook.slice(
      hook.indexOf("const reload = useCallback(async () => {", 1000),
      hook.indexOf("const selectItem", 1000)
    );
    assert.equal(initialLoad.includes("markDisplayedJobAttentionRead("), false);
    assert.match(nextAction, /focusRequested/);
    assert.match(nextAction, /void onMarkRead\(selectedItem\.id\)/);
  });

  test("contact navigation survives personal-read failure", () => {
    assert.match(nextAction, /read\.catch\(\(\) => false\)/);
    assert.match(nextAction, /window\.location\.href = href/);
    assert.match(nextAction, /Promise\.race/);
  });

  test("demotes Proposals request rows to read-only context", () => {
    assert.equal(proposals.includes("onMarkSeen={(id)"), false);
    assert.equal(proposals.includes("onDismiss={(id)"), false);
    assert.match(proposals, /additional active/);
  });

  test("Job Card Attention is a compact actionable notice", () => {
    assert.match(nextAction, /data-jobcard-next-action-compact/);
    assert.match(nextAction, /Review proposal/);
    assert.match(nextAction, /Contact customer/);
    assert.match(nextAction, />\s*Dismiss\s*</);
    assert.match(nextAction, /onMarkSeen\(selectedItem\)/);
    assert.match(nextAction, /onReviewProposal\(selectedItem\)/);
    assert.match(nextAction, /onDismiss\(selectedItem\)/);
    assert.doesNotMatch(nextAction, />Mark seen</);
    assert.doesNotMatch(nextAction, /Dismissal removes this active action/);
    assert.doesNotMatch(nextAction, /NEEDS ATTENTION/);
    assert.doesNotMatch(nextAction, /data-attention-severity/);
    assert.doesNotMatch(nextAction, />New</);
    assert.doesNotMatch(nextAction, />Call customer</);
    assert.doesNotMatch(nextAction, />Email customer</);
  });
});
