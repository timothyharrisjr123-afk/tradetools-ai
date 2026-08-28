/**
 * Guarded Jobs Board movement matrix and interaction contracts.
 *
 * Run: npx tsx --test app/lib/boardGuardedMovement.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  BOARD_APPROVE_CONFIRM_TITLE,
  BOARD_COMPLETE_CONFIRM_TITLE,
  BOARD_DRAG_THRESHOLD_PX,
  BOARD_MOVEMENT_ACCEPTANCE_REQUIRED_COPY,
  BOARD_MOVEMENT_REACTIVATE_COPY,
  BOARD_START_WORK_CONFIRM_TITLE,
  BOARD_UNSCHEDULE_CONFIRM_BODY,
  BOARD_UNSCHEDULE_CONFIRM_TITLE,
  approvalPendingFromAttentionType,
  boardDropTargetValidity,
  buildBoardProposalCreateHref,
  findApproveJobAcceptanceItem,
  mapBoardColumnKeyToCanonicalStage,
  pointerDeltaIsDrag,
  resolveBoardGuardedMovement,
} from "./boardGuardedMovement";
import type { CanonicalJobStage } from "./jobLifecycleTypes";
import type { JobAttentionSafeItem } from "./jobAttentionReadModel";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function move(
  from: CanonicalJobStage,
  to: CanonicalJobStage | null,
  opts?: {
    dispositionActive?: boolean;
    canApproveJob?: boolean;
    hasActivePlannedSchedule?: boolean;
  }
) {
  return resolveBoardGuardedMovement({
    fromStage: from,
    toStage: to,
    dispositionActive: opts?.dispositionActive ?? true,
    canApproveJob: opts?.canApproveJob ?? false,
    hasActivePlannedSchedule: opts?.hasActivePlannedSchedule ?? false,
  });
}

describe("canonical transition matrix", () => {
  test("Intake → Proposal is proposal-create intent", () => {
    const result = move("intake", "proposal");
    assert.equal(result.allowed, true);
    if (result.allowed) assert.equal(result.intent.kind, "proposal_create");
  });

  test("Proposal → Approved requires canApproveJob", () => {
    const blocked = move("proposal", "approved");
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.reason, "missing_acceptance");
      assert.equal(blocked.message, BOARD_MOVEMENT_ACCEPTANCE_REQUIRED_COPY);
    }
    const allowed = move("proposal", "approved", { canApproveJob: true });
    assert.equal(allowed.allowed, true);
    if (allowed.allowed) assert.equal(allowed.intent.kind, "approve_job");
  });

  test("Approved → Scheduled opens workspace and does not invent a date", () => {
    const result = move("approved", "scheduled");
    assert.equal(result.allowed, true);
    if (result.allowed) {
      assert.equal(result.intent.kind, "open_schedule_workspace");
    }
  });

  test("Scheduled → Production is Start work when scheduled", () => {
    const missing = move("scheduled", "production");
    assert.equal(missing.allowed, false);
    if (!missing.allowed) assert.equal(missing.reason, "missing_schedule");
    const allowed = move("scheduled", "production", {
      hasActivePlannedSchedule: true,
    });
    assert.equal(allowed.allowed, true);
    if (allowed.allowed) assert.equal(allowed.intent.kind, "start_work");
  });

  test("Production → Complete is Complete job when scheduled", () => {
    const allowed = move("production", "complete", {
      hasActivePlannedSchedule: true,
    });
    assert.equal(allowed.allowed, true);
    if (allowed.allowed) assert.equal(allowed.intent.kind, "complete_job");
  });

  test("Scheduled → Approved is Unschedule when scheduled", () => {
    const allowed = move("scheduled", "approved", {
      hasActivePlannedSchedule: true,
    });
    assert.equal(allowed.allowed, true);
    if (allowed.allowed) assert.equal(allowed.intent.kind, "unschedule");
  });
});

describe("skip and backward rejection", () => {
  const skips: Array<[CanonicalJobStage, CanonicalJobStage]> = [
    ["intake", "approved"],
    ["intake", "scheduled"],
    ["intake", "production"],
    ["intake", "complete"],
    ["proposal", "scheduled"],
    ["proposal", "production"],
    ["proposal", "complete"],
    ["approved", "production"],
    ["approved", "complete"],
    ["scheduled", "complete"],
  ];

  for (const [from, to] of skips) {
    test(`${from} → ${to} is blocked`, () => {
      const result = move(from, to, {
        canApproveJob: true,
        hasActivePlannedSchedule: true,
      });
      assert.equal(result.allowed, false);
      if (!result.allowed) assert.equal(result.reason, "blocked");
    });
  }

  const backwards: Array<[CanonicalJobStage, CanonicalJobStage]> = [
    ["approved", "proposal"],
    ["production", "scheduled"],
    ["production", "approved"],
    ["production", "proposal"],
    ["production", "intake"],
    ["proposal", "intake"],
    ["scheduled", "proposal"],
    ["scheduled", "intake"],
  ];

  for (const [from, to] of backwards) {
    test(`${from} → ${to} is blocked`, () => {
      const result = move(from, to, { hasActivePlannedSchedule: true });
      assert.equal(result.allowed, false);
      if (!result.allowed) assert.equal(result.reason, "blocked");
    });
  }
});

describe("Complete terminal and disposition", () => {
  test("Complete → anything is terminal", () => {
    for (const to of [
      "intake",
      "proposal",
      "approved",
      "scheduled",
      "production",
    ] as const) {
      const result = move("complete", to);
      assert.equal(result.allowed, false);
      if (!result.allowed) assert.equal(result.reason, "terminal", to);
    }
  });

  test("non-active operational drag is blocked", () => {
    const result = move("scheduled", "production", {
      dispositionActive: false,
      hasActivePlannedSchedule: true,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(result.reason, "disposition");
      assert.equal(result.message, BOARD_MOVEMENT_REACTIVATE_COPY);
    }
  });

  test("unknown lane target is rejected", () => {
    const result = move("approved", null);
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.reason, "unknown_target");
  });

  test("retired deposit_paid column is not a canonical stage", () => {
    assert.equal(mapBoardColumnKeyToCanonicalStage("deposit_paid"), null);
  });
});

describe("drop target visuals and click vs drag", () => {
  test("same lane is neither valid nor invalid highlight", () => {
    assert.equal(
      boardDropTargetValidity({
        fromStage: "approved",
        toStage: "approved",
        dispositionActive: true,
        canApproveJob: false,
        hasActivePlannedSchedule: false,
      }),
      "none"
    );
  });

  test("pointer threshold distinguishes click from drag", () => {
    assert.equal(pointerDeltaIsDrag(0, 0), false);
    assert.equal(pointerDeltaIsDrag(3, 3), false);
    assert.equal(pointerDeltaIsDrag(BOARD_DRAG_THRESHOLD_PX, 0), true);
  });
});

describe("proposal create href and approve attention", () => {
  test("Intake→Proposal href opens Job Card proposals tab", () => {
    const href = buildBoardProposalCreateHref(
      "a9619d68-6d3f-43d2-8b07-7ed73ae87442"
    );
    assert.match(href, /entry=job-card/);
    assert.match(href, /tab=proposals/);
    assert.match(href, /prepare=1/);
    assert.match(href, /from=board/);
    assert.doesNotMatch(href, /stage=/);
  });

  test("findApproveJobAcceptanceItem requires real acceptance", () => {
    assert.equal(approvalPendingFromAttentionType("customer_question"), false);
    assert.equal(
      approvalPendingFromAttentionType("acceptance_confirmation_required"),
      true
    );
    const items: JobAttentionSafeItem[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        jobId: "22222222-2222-4222-8222-222222222222",
        proposalId: "33333333-3333-4333-8333-333333333333",
        proposalVersionId: "44444444-4444-4444-8444-444444444444",
        attentionType: "acceptance_confirmation_required",
        sourceType: "proposal_acceptances",
        sourceId: "55555555-5555-4555-8555-555555555555",
        status: "open",
        severity: "high",
        openedAt: "2026-08-01T00:00:00.000Z",
        acknowledgedAt: null,
        destination: {
          kind: "job_card_proposals",
          proposalId: "33333333-3333-4333-8333-333333333333",
          proposalVersionId: "44444444-4444-4444-8444-444444444444",
          requestId: null,
          acceptanceId: "55555555-5555-4555-8555-555555555555",
          tab: "proposals",
          anchor: "acceptance_confirmation",
        },
        request: null,
        acceptance: {
          acceptanceId: "55555555-5555-4555-8555-555555555555",
          packageLabel: null,
          acceptedTotalCents: 1000,
          ambiguityReason: null,
          contractorReason: null,
          reviewRequired: false,
          attentionAction: "approve_job",
          acceptedAt: "2026-08-01T00:00:00.000Z",
          acceptedByName: null,
          acceptedByEmail: null,
        },
        personalReadAt: null,
        personalLastViewedAt: null,
      },
    ];
    const found = findApproveJobAcceptanceItem(items);
    assert.equal(found?.acceptance?.acceptanceId, items[0].acceptance?.acceptanceId);
  });
});

describe("surface architecture", () => {
  const files = [
    "app/lib/boardGuardedMovement.ts",
    "app/tools/roofing/saved/SavedClient.tsx",
    "app/tools/roofing/saved/components/JobsBoardCard.tsx",
    "app/tools/roofing/saved/components/JobsBoardColumn.tsx",
    "app/tools/roofing/saved/components/BoardMovementConfirmDialog.tsx",
  ];

  test("no direct jobs.stage writer in Board movement", () => {
    for (const rel of files) {
      const source = read(rel);
      assert.doesNotMatch(source, /jobs\.update\(\s*\{\s*stage/);
      assert.doesNotMatch(source, /\.update\(\s*\{\s*stage\s*:/);
      assert.doesNotMatch(source, /allow_stage_write/);
    }
  });

  test("drag uses existing canonical APIs", () => {
    const saved = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.match(saved, /\/api\/jobs\/confirm-acceptance/);
    assert.match(saved, /\/api\/jobs\/start-work/);
    assert.match(saved, /\/api\/jobs\/complete-work/);
    assert.match(saved, /\/api\/jobs\/unschedule/);
    assert.match(saved, /open_schedule_workspace/);
    assert.match(saved, /buildBoardProposalCreateHref/);
    assert.doesNotMatch(saved, /card_dragged|job_moved_by_drag/);
  });

  test("Board card exposes keyboard equivalents and no payment badges", () => {
    const card = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
    assert.match(card, /data-board-approve-job/);
    assert.match(card, /data-board-schedule-job/);
    assert.match(card, /data-board-start-work/);
    assert.match(card, /data-board-complete-job/);
    assert.match(card, /pointer-events-auto/);
    assert.doesNotMatch(card, /deposit badge|balance due|Payment status/i);
    assert.doesNotMatch(card, /data-board-payment/);
    assert.match(card, /data-board-open-job/);
    assert.match(card, /pointerDeltaIsDrag|BOARD_DRAG_THRESHOLD_PX|onPointerDown/);
  });

  test("confirm copy is lightweight and Unschedule does not say deleted", () => {
    assert.equal(BOARD_APPROVE_CONFIRM_TITLE, "Approve job?");
    assert.equal(BOARD_START_WORK_CONFIRM_TITLE, "Start work?");
    assert.equal(BOARD_COMPLETE_CONFIRM_TITLE, "Complete job?");
    assert.equal(BOARD_UNSCHEDULE_CONFIRM_TITLE, "Unschedule job?");
    assert.match(BOARD_UNSCHEDULE_CONFIRM_BODY, /return to Approved/);
    assert.doesNotMatch(BOARD_UNSCHEDULE_CONFIRM_BODY.toLowerCase(), /deleted/);
    const dialog = read(
      "app/tools/roofing/saved/components/BoardMovementConfirmDialog.tsx"
    );
    assert.match(dialog, /role="alertdialog"/);
    assert.match(dialog, /Escape/);
  });

  test("Job Card seeds proposals tab from Intake→Proposal href", () => {
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(client, /searchParams\.get\("tab"\)/);
    assert.match(client, /coerceJobCardVisibleTab/);
  });

  test("List view has no drag and keeps canonical actions", () => {
    const list = read(
      "app/tools/roofing/saved/components/JobsBoardListView.tsx"
    );
    assert.doesNotMatch(list, /onPointerDown/);
    assert.match(list, /data-board-list-open-job/);
    assert.match(list, /onApproveJob|data-board-list-approve-job/);
  });

  test("no new DnD package", () => {
    const pkg = read("package.json");
    assert.doesNotMatch(pkg, /dnd-kit|react-dnd|react-beautiful-dnd|hello-pangea/);
  });

  test("failure restores source lane and uses coalesced Board refresh", () => {
    const saved = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.match(saved, /refreshDbJobs/);
    assert.doesNotMatch(saved, /canonicalBoardLane:/);
    assert.doesNotMatch(saved, /status:\s*"scheduled"/);
    assert.match(
      read("app/tools/roofing/saved/useBoardCanonicalJobs.ts"),
      /beginCoalescedRefresh/
    );
  });

  test("drag is mouse-only; keyboard and mobile use labeled actions", () => {
    const card = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
    assert.match(card, /pointerType !== "mouse"/);
    assert.match(card, /data-board-approve-job/);
    assert.match(card, /data-board-schedule-job/);
    const dialog = read(
      "app/tools/roofing/saved/components/BoardMovementConfirmDialog.tsx"
    );
    assert.match(dialog, /restoreFocusRef/);
    assert.match(dialog, /confirmRef\.current\?\.focus/);
  });
});
