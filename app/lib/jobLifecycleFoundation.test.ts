/**
 * Job Lifecycle Foundation — mapper, write policy, activity composer, SQL contract.
 *
 * Run:
 * npx tsx --test app/lib/jobLifecycleFoundation.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { composeJobActivityItems } from "./jobActivityComposer";
import {
  assertCanonicalWriteStage,
  assertOperationalDispositionWrite,
  isAllowedStageEdge,
  resolveCanonicalJobStage,
  resolveCanonicalJobStageLabel,
  resolveStageEnteredAtIso,
  shouldOmitTimeInStage,
} from "./jobLifecycleMapper";
import {
  buildChangeJobDispositionPayload,
  buildRecordJobActivityPayload,
  buildTransitionJobStagePayload,
  CHANGE_JOB_DISPOSITION_RPC_V1,
  parseTransitionJobStageResult,
  previewStageTransition,
  RECORD_JOB_ACTIVITY_RPC_V1,
  TRANSITION_JOB_STAGE_RPC_V1,
  transitionJobStageViaRpc,
} from "./jobLifecyclePersistence";
import { JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED, AUTHENTICATED_MANUAL_JOB_ACTIVITY_EVENT_TYPES, SYSTEM_RESERVED_JOB_ACTIVITY_EVENT_TYPES } from "./jobLifecycleTypes";
import { estimateSnapshotToJobDraft, jobDraftToInsertRow } from "./jobStore";
import {
  mapDbJobStageToBoardColumnKey,
  mapDbJobToBoardEstimate,
  mapDbJobToEstimateStatus,
} from "./jobBoardAdapter";
import type { JobSummary } from "./jobTypes";
import { getDefaultVisibleColumnKeys, getStageAnchorIso } from "../tools/roofing/saved/jobsBoardUtils";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260816_038_job_lifecycle_foundation.sql"
);
const DRAFT_CREATE_036 = join(
  process.cwd(),
  "supabase/migrations/20260815_036_add_composition_role_and_slot.sql"
);
const TOKEN_037 = join(
  process.cwd(),
  "supabase/migrations/20260815_037_add_token_category_and_email_send_supersede_rpc.sql"
);

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function job(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    id: JOB_ID,
    company_id: COMPANY_ID,
    customer_name: "Test",
    job_name: "Test — roofing",
    stage: "intake",
    status: "active",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("canonical read mapping", () => {
  test("measurement and estimating map to Intake", () => {
    assert.equal(resolveCanonicalJobStage({ stage: "measurement" }), "intake");
    assert.equal(resolveCanonicalJobStage({ stage: "estimating" }), "intake");
    assert.equal(resolveCanonicalJobStageLabel({ stage: "measurement" }), "Intake");
  });

  test("canonical stages pass through", () => {
    assert.equal(resolveCanonicalJobStage({ stage: "proposal" }), "proposal");
    assert.equal(resolveCanonicalJobStage({ stage: "approved" }), "approved");
    assert.equal(resolveCanonicalJobStage({ stage: "scheduled" }), "scheduled");
    assert.equal(resolveCanonicalJobStage({ stage: "production" }), "production");
    assert.equal(resolveCanonicalJobStage({ stage: "complete" }), "complete");
  });

  test("won + pre-approved stage reads as Approved", () => {
    assert.equal(
      resolveCanonicalJobStage({ stage: "intake", status: "won" }),
      "approved"
    );
    assert.equal(
      resolveCanonicalJobStage({ stage: "measurement", status: "won" }),
      "approved"
    );
    assert.equal(
      resolveCanonicalJobStage({ stage: "proposal", status: "won" }),
      "approved"
    );
  });

  test("won + later stage lets stage win", () => {
    assert.equal(
      resolveCanonicalJobStage({ stage: "production", status: "won" }),
      "production"
    );
    assert.equal(
      resolveCanonicalJobStage({ stage: "complete", status: "won" }),
      "complete"
    );
  });

  test("legacy archived resolution is not automatic Complete", () => {
    assert.equal(
      resolveCanonicalJobStage({ stage: "archived", status: "lost" }),
      "proposal"
    );
    assert.equal(
      resolveCanonicalJobStage({ stage: "archived", status: "won" }),
      "approved"
    );
    assert.equal(
      resolveCanonicalJobStage({
        stage: "archived",
        status: "active",
        active_proposal_id: JOB_ID,
      }),
      "proposal"
    );
    assert.equal(
      resolveCanonicalJobStage({ stage: "archived", status: "active" }),
      "intake"
    );
  });
});

describe("write policy", () => {
  test("only canonical stages are writable", () => {
    assert.equal(assertCanonicalWriteStage("proposal"), "proposal");
    assert.throws(() => assertCanonicalWriteStage("measurement"));
    assert.throws(() => assertCanonicalWriteStage("estimating"));
    assert.throws(() => assertCanonicalWriteStage("archived"));
  });

  test("won and archived are rejected as disposition targets", () => {
    assert.throws(() => assertOperationalDispositionWrite("won"));
    assert.throws(() => assertOperationalDispositionWrite("archived"));
    assert.equal(assertOperationalDispositionWrite("on_hold"), "on_hold");
    assert.equal(assertOperationalDispositionWrite("lost"), "lost");
  });

  test("Approved → Scheduled is blocked until R3F", () => {
    assert.equal(JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED, false);
    assert.equal(isAllowedStageEdge("approved", "scheduled"), false);
    assert.equal(previewStageTransition({ stage: "approved" }, "scheduled").blockedUntilR3f, true);
    assert.throws(() =>
      buildTransitionJobStagePayload({
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        to_stage: "scheduled",
      })
    );
  });

  test("live write surface enables Intake → Proposal only", () => {
    assert.equal(isAllowedStageEdge("intake", "proposal"), true);
    assert.equal(isAllowedStageEdge("intake", "intake"), true);
    assert.equal(isAllowedStageEdge("proposal", "proposal"), true);
    assert.equal(isAllowedStageEdge("intake", "approved"), false);
    assert.equal(isAllowedStageEdge("proposal", "approved"), false);
    assert.equal(isAllowedStageEdge("approved", "scheduled"), false);
    assert.equal(isAllowedStageEdge("scheduled", "production"), false);
    assert.equal(isAllowedStageEdge("production", "complete"), false);
    assert.throws(() =>
      buildTransitionJobStagePayload({
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        to_stage: "approved",
      })
    );
    assert.throws(() =>
      buildTransitionJobStagePayload({
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        to_stage: "production",
      })
    );
    assert.throws(() =>
      buildTransitionJobStagePayload({
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        to_stage: "complete",
      })
    );
  });
});

describe("time in stage", () => {
  test("uses stage_entered_at and omits when null", () => {
    assert.equal(resolveStageEnteredAtIso("2026-08-16T12:00:00.000Z"), "2026-08-16T12:00:00.000Z");
    assert.equal(shouldOmitTimeInStage(null), true);
    assert.equal(shouldOmitTimeInStage(""), true);
    assert.equal(getStageAnchorIso({ createdAt: "2026-01-01T00:00:00.000Z" } as never), null);
  });

  test("board sort owner is stageEnteredAt only", () => {
    const withClock = {
      createdAt: "2026-01-01T00:00:00.000Z",
      stageEnteredAt: "2026-08-01T00:00:00.000Z",
    } as never;
    const withoutClock = {
      createdAt: "2026-01-01T00:00:00.000Z",
    } as never;
    assert.equal(getStageAnchorIso(withClock), "2026-08-01T00:00:00.000Z");
    assert.equal(getStageAnchorIso(withoutClock), null);
  });
});

describe("new job create paths", () => {
  test("estimate bridge no longer writes measurement stage", () => {
    const draft = estimateSnapshotToJobDraft(
      {
        id: JOB_ID,
        customerName: "Pat",
        roofAreaSqFt: 2400,
        address: "1 Main",
      },
      COMPANY_ID
    );
    assert.equal(draft.stage, "intake");
    const row = jobDraftToInsertRow(draft);
    assert.equal(row.stage, "intake");
  });
});

describe("board canonical lanes", () => {
  test("one canonical stage maps to one lane", () => {
    assert.equal(mapDbJobStageToBoardColumnKey(job({ stage: "measurement" })), "estimate");
    assert.equal(mapDbJobStageToBoardColumnKey(job({ stage: "intake" })), "estimate");
    assert.equal(
      mapDbJobStageToBoardColumnKey(job({ stage: "proposal", active_proposal_id: null })),
      "leads"
    );
    assert.equal(
      mapDbJobStageToBoardColumnKey(job({ stage: "proposal", active_proposal_id: JOB_ID })),
      "leads"
    );
    assert.equal(mapDbJobStageToBoardColumnKey(job({ stage: "approved" })), "approved");
    assert.equal(mapDbJobStageToBoardColumnKey(job({ stage: "production" })), "in_progress");
    assert.equal(mapDbJobStageToBoardColumnKey(job({ stage: "complete" })), "paid");
  });

  test("active_proposal_id does not imply Proposal Sent status", () => {
    const mapped = mapDbJobToEstimateStatus(
      job({ stage: "proposal", active_proposal_id: JOB_ID })
    );
    assert.notEqual(mapped, "sent_pending");
    assert.equal(mapped, "estimate");
  });

  test("complete maps Complete lane, not a payment status owner", () => {
    const row = mapDbJobToBoardEstimate(job({ stage: "complete" }));
    assert.equal((row as { canonicalBoardLane?: string }).canonicalBoardLane, "paid");
    assert.equal((row as { jobHasProposal?: boolean }).jobHasProposal, false);
  });

  test("Scheduled lane is visible once R3F owns production scheduling", () => {
    const visible = getDefaultVisibleColumnKeys();
    assert.equal(visible.includes("scheduled"), true);
    assert.equal(visible.includes("deposit_paid"), false);
    assert.deepEqual(visible, [
      "estimate",
      "leads",
      "approved",
      "scheduled",
      "in_progress",
      "paid",
    ]);
  });

  test("won + intake reads into Approved lane", () => {
    assert.equal(
      mapDbJobStageToBoardColumnKey(job({ stage: "intake", status: "won" })),
      "approved"
    );
  });
});

describe("activity composer", () => {
  test("includes job created and hides first-proposal stage plus customer requests", () => {
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-01T00:00:00.000Z",
      jobActivityEvents: [
        {
          id: JOB_ID,
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "stage_changed",
          occurred_at: "2026-08-02T00:00:00.000Z",
          payload_json: {
            from_stage: "intake",
            to_stage: "proposal",
            reason: "first_proposal_created",
          },
        },
      ],
      customerRequestItems: [
        {
          label: "Customer requested Enhanced",
          note: "New request",
          when: "Aug 3",
        },
      ],
    });
    assert.equal(items.some((item) => item.label === "Job created"), true);
    assert.equal(items.some((item) => item.label === "Moved to Proposal"), false);
    assert.equal(items.some((item) => item.label === "Customer requested Enhanced"), false);
  });

  test("composes proposal sent from durable facts, not draft created", () => {
    const items = composeJobActivityItems({
      proposals: [
        {
          id: JOB_ID,
          job_id: JOB_ID,
          status: "sent",
          title: "Roof",
          proposal_number: null,
          template_id: JOB_ID,
          selected_option_id: null,
          latest_sent_version_id: JOB_ID,
          signed_version_id: null,
          created_at: "2026-08-02T00:00:00.000Z",
          updated_at: "2026-08-03T00:00:00.000Z",
          draft_content_changed_at: "2026-08-03T00:00:00.000Z",
        },
      ],
      sentFactsByProposalId: {
        [JOB_ID]: { latestSentFrozenAt: "2026-08-03T00:00:00.000Z" },
      },
    });
    assert.equal(items.some((item) => item.label === "Proposal created"), false);
    assert.equal(items.some((item) => item.label === "Proposal sent"), true);
  });

  test("rejects Job Card opened, autosave, previewed, and snapshot_frozen labels", () => {
    const items = composeJobActivityItems({
      customerRequestItems: [
        { label: "Job card opened", note: "New job / intake path" },
        { label: "Autosave", note: "draft_saved" },
        { label: "previewed", note: "Preview opened" },
        { label: "snapshot_frozen", note: "Freeze" },
      ],
    });
    assert.equal(items.length, 0);
  });

  test("acceptance uses accepted_at so it sorts between Job created and Approved", () => {
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-16T14:25:14.000Z",
      jobActivityEvents: [
        {
          id: JOB_ID,
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "stage_changed",
          occurred_at: "2026-08-16T14:32:46.000Z",
          payload_json: {
            from_stage: "proposal",
            to_stage: "approved",
            reason: "contractor_approved",
          },
        },
      ],
      acceptanceItems: [
        {
          label: "Proposal accepted",
          note: "Premium package",
          acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
          acceptedAt: "2026-08-16T14:31:20.000Z",
        },
      ],
    });
    assert.deepEqual(
      items.map((item) => item.label),
      ["Work approved", "Proposal accepted", "Job created"]
    );
  });

  test("two same-package acceptances stay separate and order by accepted_at", () => {
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-16T14:25:14.000Z",
      jobActivityEvents: [
        {
          id: JOB_ID,
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "stage_changed",
          occurred_at: "2026-08-16T14:25:16.000Z",
          payload_json: {
            from_stage: "proposal",
            to_stage: "approved",
            reason: "contractor_approved",
          },
        },
      ],
      acceptanceItems: [
        {
          label: "Proposal accepted",
          note: "Premium package",
          acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
          acceptedAt: "2026-08-16T14:25:15.000Z",
        },
        {
          label: "Proposal accepted",
          note: "Premium package",
          acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
          acceptedAt: "2026-08-16T14:28:45.000Z",
        },
      ],
    });
    const accepted = items.filter((item) => item.label === "Proposal accepted");
    assert.equal(accepted.length, 2);
    assert.deepEqual(
      items.map((item) => item.label),
      [
        "Proposal accepted",
        "Work approved",
        "Proposal accepted",
        "Job created",
      ]
    );
  });

  test("same logical acceptance id remains one Activity item", () => {
    const row = {
      label: "Proposal accepted",
      note: "Premium package",
      acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      acceptedAt: "2026-08-16T14:31:20.000Z",
    };
    const items = composeJobActivityItems({
      acceptanceItems: [row, { ...row }],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.label, "Proposal accepted");
  });

  test("does not emit Acceptance confirmed or Acknowledge as Activity", () => {
    const items = composeJobActivityItems({
      acceptanceItems: [
        {
          label: "Acceptance confirmed",
          note: "Contractor confirmed",
          acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
          acceptedAt: "2026-08-16T14:32:46.000Z",
        },
        {
          label: "Proposal accepted",
          note: "Premium package",
          acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
          acceptedAt: "2026-08-16T14:31:20.000Z",
        },
      ],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.label, "Proposal accepted");
    assert.equal(
      items.some((item) => /acknowledge|acceptance confirmed/i.test(item.label)),
      false
    );
  });
});

describe("RPC payload guards", () => {
  test("disposition payload preserves stage clock fields by omission", () => {
    const payload = buildChangeJobDispositionPayload({
      company_id: COMPANY_ID,
      job_id: JOB_ID,
      to_status: "on_hold",
    });
    assert.equal("stage" in payload, false);
    assert.equal("stage_entered_at" in payload, false);
    assert.equal(payload.to_status, "on_hold");
  });

  test("reserved Activity types cannot be client-built", () => {
    assert.deepEqual([...SYSTEM_RESERVED_JOB_ACTIVITY_EVENT_TYPES], [
      "job_created",
      "stage_changed",
      "disposition_changed",
      "job_scheduled",
      "job_rescheduled",
      "job_unscheduled",
      "job_work_started",
      "job_work_completed",
    ]);
    assert.deepEqual([...AUTHENTICATED_MANUAL_JOB_ACTIVITY_EVENT_TYPES], []);
    for (const eventType of SYSTEM_RESERVED_JOB_ACTIVITY_EVENT_TYPES) {
      assert.throws(() =>
        buildRecordJobActivityPayload({
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: eventType,
        })
      );
    }
  });

  test("Intake→Proposal without proposal truth is a typed RPC failure", () => {
    const missing = parseTransitionJobStageResult({
      ok: false,
      code: "proposal_truth_required",
      from_stage: "intake",
      to_stage: "proposal",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "proposal_truth_required");

    const mismatch = parseTransitionJobStageResult({
      ok: false,
      code: "proposal_truth_mismatch",
      from_stage: "intake",
      to_stage: "proposal",
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.code, "proposal_truth_mismatch");
  });

  test("same-target transition parse marks idempotent", () => {
    const result = parseTransitionJobStageResult({
      ok: true,
      idempotent: true,
      job_id: JOB_ID,
      from_stage: "proposal",
      to_stage: "proposal",
      stage_entered_at: "2026-08-02T00:00:00.000Z",
      status_unchanged: "active",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.idempotent, true);
      assert.equal(result.stage_entered_at, "2026-08-02T00:00:00.000Z");
    }
  });

  test("transition RPC uses guarded function only", async () => {
    let rpcName = "";
    const supabase = {
      rpc: async (name: string) => {
        rpcName = name;
        return {
          data: {
            ok: true,
            idempotent: false,
            job_id: JOB_ID,
            from_stage: "intake",
            to_stage: "proposal",
            stage_entered_at: "2026-08-16T00:00:00.000Z",
            status_unchanged: "active",
          },
          error: null,
        };
      },
    };
    const result = await transitionJobStageViaRpc(supabase as never, {
      company_id: COMPANY_ID,
      job_id: JOB_ID,
      to_stage: "proposal",
      mode: "auto",
    });
    assert.equal(rpcName, TRANSITION_JOB_STAGE_RPC_V1);
    assert.equal(result.ok, true);
  });
});

describe("038 SQL contract", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const draft036 = readFileSync(DRAFT_CREATE_036, "utf8");
  const token037 = readFileSync(TOKEN_037, "utf8");

  test("is job lifecycle foundation, not C4 token hardening", () => {
    assert.match(sql, /Job Lifecycle Foundation/);
    assert.match(sql, /NOT the deferred C4 public-token mint hardening/);
    assert.doesNotMatch(sql, /contractor_email_send/);
    assert.doesNotMatch(sql, /persist_proposal_public_access_mint/);
    assert.match(token037, /contractor_email_send/);
  });

  test("adds stage_entered_at nullable with no created_at backfill", () => {
    assert.match(sql, /add column if not exists stage_entered_at timestamptz null/);
    assert.doesNotMatch(
      sql,
      /update public\.jobs[\s\S]{0,200}stage_entered_at\s*=\s*created_at/i
    );
  });

  test("widens stage CHECK with scheduled and keeps legacy readable values", () => {
    assert.match(sql, /drop constraint if exists jobs_stage_check/);
    assert.match(sql, /'scheduled'/);
    assert.match(sql, /'measurement'/);
    assert.match(sql, /'estimating'/);
    assert.match(sql, /'archived'/);
  });

  test("creates job_activity_events with RLS select-only for authenticated", () => {
    assert.match(sql, /create table if not exists public\.job_activity_events/);
    assert.match(sql, /grant select on table public\.job_activity_events to authenticated/);
    assert.match(sql, /revoke all on table public\.job_activity_events from authenticated/);
  });

  test("exposes guarded transition and disposition RPCs with future edges blocked", () => {
    assert.match(sql, new RegExp(`create or replace function public\\.${TRANSITION_JOB_STAGE_RPC_V1}`));
    assert.match(sql, new RegExp(`create or replace function public\\.${CHANGE_JOB_DISPOSITION_RPC_V1}`));
    assert.match(sql, new RegExp(`create or replace function public\\.${RECORD_JOB_ACTIVITY_RPC_V1}`));
    assert.match(sql, /approved_blocked_until_r3c/);
    assert.match(sql, /scheduled_blocked_until_r3f/);
    assert.match(sql, /production_blocked_until_start_work/);
    assert.match(sql, /complete_blocked_until_complete_action/);
    assert.match(sql, /illegal_disposition_target/);
    assert.match(sql, /idempotent/);
    assert.match(sql, /if not \(v_from = 'intake' and v_to = 'proposal'\)/);
    assert.doesNotMatch(
      sql,
      /or \(v_from = 'proposal' and v_to = 'approved'\)/
    );
    assert.doesNotMatch(
      sql,
      /or \(v_from = 'scheduled' and v_to = 'production'\)/
    );
  });

  test("raw stage/status writes are trigger- and column-guarded", () => {
    assert.match(sql, /jobs\.stage may only change via transition_job_stage_v1/);
    assert.match(sql, /jobs\.status may only change via change_job_disposition_v1/);
    assert.match(sql, /jobs\.stage write target % is not canonical/);
    assert.match(sql, /revoke update on table public\.jobs from authenticated/);
    assert.match(sql, /revoke update on table public\.jobs from service_role/);
    assert.match(sql, /grant update \(/);
    assert.doesNotMatch(
      sql.slice(sql.indexOf("grant update (")),
      /grant update \([\s\S]*?\bstage\b[\s\S]*?\) on table public\.jobs to authenticated/
    );
  });

  test("Activity RLS is tenant-scoped SELECT with no client write policies", () => {
    assert.match(sql, /alter table public\.job_activity_events enable row level security/);
    assert.doesNotMatch(sql, /force row level security/i);
    assert.match(sql, /job_activity_events_select_company_scope/);
    assert.match(sql, /from public\.company_memberships/);
    assert.match(sql, /where user_id = auth\.uid\(\)/);
    assert.match(sql, /grant select on table public\.job_activity_events to authenticated/);
    assert.match(sql, /revoke all on table public\.job_activity_events from authenticated/);
    assert.doesNotMatch(sql, /on public\.job_activity_events\s+for insert/i);
    assert.doesNotMatch(sql, /on public\.job_activity_events\s+for update/i);
    assert.doesNotMatch(sql, /on public\.job_activity_events\s+for delete/i);
  });

  test("Activity FKs restrict orphans and actor is auth.users SET NULL", () => {
    assert.match(sql, /references public\.companies\(id\) on delete restrict/);
    assert.match(
      sql,
      /foreign key \(job_id, company_id\)[\s\S]*references public\.jobs \(id, company_id\)[\s\S]*on delete restrict/
    );
    assert.match(sql, /actor_user_id uuid null references auth\.users\(id\) on delete set null/);
  });

  test("record_job_activity_v1 has no authenticated write surface", () => {
    const rec = sql.slice(
      sql.indexOf("create or replace function public.record_job_activity_v1"),
      sql.indexOf("create or replace function public.job_lifecycle_insert_activity")
    );
    assert.match(rec, /event_type_reserved/);
    assert.match(rec, /'job_created', 'stage_changed', 'disposition_changed'/);
    assert.doesNotMatch(rec, /insert into public\.job_activity_events/);
    assert.match(
      rec,
      /revoke all on function public\.record_job_activity_v1\(jsonb\) from authenticated/
    );
    assert.doesNotMatch(
      rec,
      /grant execute on function public\.record_job_activity_v1\(jsonb\) to authenticated/
    );
    assert.match(
      rec,
      /grant execute on function public\.record_job_activity_v1\(jsonb\) to service_role/
    );
  });

  test("Intake→Proposal RPC requires durable same-job proposal truth", () => {
    assert.match(sql, /job_lifecycle_has_proposal_truth/);
    assert.match(sql, /proposal_truth_required/);
    assert.match(sql, /proposal_truth_mismatch/);
    const helper = sql.slice(
      sql.indexOf("create or replace function public.job_lifecycle_has_proposal_truth")
    );
    const helperBody = helper.slice(0, helper.indexOf("revoke all on function public.job_lifecycle_has_proposal_truth"));
    assert.match(helperBody, /from public\.proposals p/);
    assert.match(helperBody, /join public\.proposal_versions pv/);
    assert.match(helperBody, /p\.job_id = p_job_id/);
    assert.match(helperBody, /p\.company_id = p_company_id/);
    assert.match(helperBody, /p\.deleted_at is null/);
    const transition = sql.slice(
      sql.indexOf("create or replace function public.transition_job_stage_v1")
    );
    const truthIdx = transition.indexOf("proposal_truth_required");
    const updateIdx = transition.indexOf("update public.jobs");
    assert.equal(truthIdx >= 0 && updateIdx > truthIdx, true);
    assert.match(
      transition,
      /if not public\.job_lifecycle_has_proposal_truth\([\s\S]*v_job\.active_proposal_id/
    );
  });

  test("first proposal AUTO remains the primary producer and still requires proposal truth", () => {
    assert.match(sql, /old\.active_proposal_id is null/);
    assert.match(sql, /new\.active_proposal_id is not null/);
    assert.match(sql, /v_from = 'intake'/);
    assert.match(sql, /new\.stage := 'proposal'/);
    assert.match(sql, /new\.stage_entered_at := now\(\)/);
    assert.match(sql, /first_proposal_created/);
    assert.match(
      sql,
      /and public\.job_lifecycle_has_proposal_truth\(\s*new\.company_id,\s*new\.id,\s*new\.active_proposal_id/
    );
    assert.doesNotMatch(sql, /create or replace function public\.persist_draft_proposal_create_v1/);
    assert.match(draft036, /persist_draft_proposal_create_v1/);
    assert.match(draft036, /set active_proposal_id = v_proposal_id/);
  });

  test("new inserts canonicalize measurement\/estimating, reject later stages, and do not backfill", () => {
    assert.match(sql, /jobs_lifecycle_before_insert/);
    assert.match(sql, /new\.stage := 'intake'/);
    assert.match(sql, /new jobs must start in intake/);
    assert.match(sql, /new\.stage = 'intake' and new\.stage_entered_at is null/);
    assert.match(sql, /job_created/);
    assert.doesNotMatch(sql, /update public\.jobs\s+set\s+stage\s*=\s*'intake'/i);
    assert.doesNotMatch(
      sql,
      /update public\.jobs[\s\S]{0,200}stage_entered_at\s*=\s*created_at/i
    );
  });

  test("RPC security is DEFINER with search_path public and no PUBLIC\/anon execute", () => {
    for (const name of [
      TRANSITION_JOB_STAGE_RPC_V1,
      CHANGE_JOB_DISPOSITION_RPC_V1,
    ]) {
      const fn = sql.slice(sql.indexOf(`create or replace function public.${name}`));
      const head = fn.slice(0, 400);
      assert.match(head, /security definer/i);
      assert.match(head, /set search_path = public/);
      assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(jsonb\\) from public`));
      assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(jsonb\\) from anon`));
      assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(jsonb\\) to authenticated`));
      assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(jsonb\\) to service_role`));
    }
    const activityHead = sql.slice(
      sql.indexOf("create or replace function public.record_job_activity_v1"),
      sql.indexOf("create or replace function public.record_job_activity_v1") + 400
    );
    assert.match(activityHead, /security definer/i);
    assert.match(activityHead, /set search_path = public/);
    assert.match(
      sql,
      /revoke all on function public\.job_lifecycle_insert_activity[\s\S]*from authenticated/
    );
  });

  test("does not implement acceptance, freeze, tokens, or pricing", () => {
    assert.doesNotMatch(sql, /persist_proposal_send_freeze_v1/);
    assert.doesNotMatch(sql, /jobs\.stage = 'approved'/);
    assert.doesNotMatch(sql, /customer_total_cents/);
    assert.doesNotMatch(sql, /create table if not exists public\.appointments/);
  });

  test("jobs_stage_check and jobs_status_check contracts", () => {
    const stageCheck = sql.match(
      /add constraint jobs_stage_check check \(\s*stage in \(([\s\S]*?)\)\s*\)/
    );
    assert.ok(stageCheck);
    const stages = [...stageCheck[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(stages, [
      "intake",
      "measurement",
      "estimating",
      "proposal",
      "approved",
      "scheduled",
      "production",
      "complete",
      "archived",
    ]);
    assert.match(sql, /jobs\.status CHECK is unchanged: active, on_hold, won, lost, closed, archived/);
    assert.doesNotMatch(sql, /drop constraint if exists jobs_status_check/);
  });

  test("disposition UPDATE preserves stage clock columns", () => {
    const disp = sql.slice(sql.indexOf("create or replace function public.change_job_disposition_v1"));
    const update = disp.match(/update public\.jobs\s+set([\s\S]*?)where/)?.[1] ?? "";
    assert.match(update, /status = v_to/);
    assert.match(update, /last_activity_at = v_now/);
    assert.doesNotMatch(update, /\bstage\b/);
    assert.doesNotMatch(update, /stage_entered_at/);
  });
});
