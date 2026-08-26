/**
 * R3C — Formal customer acceptance contracts (contractor-controlled approval).
 *
 * Run:
 * npx tsx --test app/lib/proposalFormalAcceptance.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { attentionHeadline } from "./jobAttentionReadModel";
import { parseConfirmProposalAcceptanceResult } from "./proposalAcceptancePersistence";
import { classifyProposalAcceptanceGuard } from "./proposalAcceptanceClassifier";
import {
  ACKNOWLEDGE_PROPOSAL_ACCEPTANCE_ATTENTION_RPC_V1,
  CONFIRM_PROPOSAL_ACCEPTANCE_RPC_V1,
  formatProposalAcceptanceAttentionDetail,
  PROPOSAL_ACCEPTANCE_ACKNOWLEDGE_CTA,
  PROPOSAL_ACCEPTANCE_APPROVE_JOB_CTA,
  PROPOSAL_ACCEPTANCE_ATTENTION_TYPE,
  RECORD_PROPOSAL_ACCEPTANCE_RPC_V1,
  resolveProposalAcceptanceAttentionAction,
} from "./proposalAcceptanceTypes";
import { isMutableDraftDirtyAfterSentFreeze } from "./proposalContractorLifecycle";
import {
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_PROPOSAL_CTA,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA,
  formatProposalCustomerAcceptedOnSentence,
} from "./proposalCustomerPacketViewModel";
import { RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1 } from "./proposalCustomerRequestPersistence";
import { TRANSITION_JOB_STAGE_RPC_V1 } from "./jobLifecyclePersistence";
import { JOB_LIFECYCLE_APPROVED_TRANSITIONS_ENABLED } from "./jobLifecycleTypes";
import { isAllowedStageEdge } from "./jobLifecycleMapper";

const ROOT = process.cwd();
const MIGRATION_040 = join(
  ROOT,
  "supabase/migrations/20260816_040_proposal_formal_acceptance.sql"
);
const MIGRATION_038 = join(
  ROOT,
  "supabase/migrations/20260816_038_job_lifecycle_foundation.sql"
);
const MIGRATION_039 = join(
  ROOT,
  "supabase/migrations/20260816_039_proposal_formal_acceptance.sql"
);

const sql040 = readFileSync(MIGRATION_040, "utf8");
const sql038 = readFileSync(MIGRATION_038, "utf8");
const recordFn = sql040.slice(
  sql040.indexOf("create or replace function public.record_proposal_acceptance_v1"),
  sql040.indexOf("create or replace function public.confirm_proposal_acceptance_v1")
);
const confirmFn = sql040.slice(
  sql040.indexOf("create or replace function public.confirm_proposal_acceptance_v1"),
  sql040.indexOf(
    "create or replace function public.acknowledge_proposal_acceptance_attention_v1"
  )
);
const confirmIdempotent = confirmFn.slice(
  confirmFn.indexOf("if v_acceptance.confirmed_at is not null then"),
  confirmFn.indexOf("if exists (")
);
const ackFn = sql040.slice(
  sql040.indexOf(
    "create or replace function public.acknowledge_proposal_acceptance_attention_v1"
  )
);

const IDS = {
  company: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  job: "11111111-1111-4111-8111-111111111111",
  proposal: "22222222-2222-4222-8222-222222222222",
  v5: "55555555-5555-4555-8555-555555555555",
  v6: "66666666-6666-4666-8666-666666666666",
  option: "99999999-9999-4999-8999-999999999999",
};

function cleanInput(
  overrides: Partial<Parameters<typeof classifyProposalAcceptanceGuard>[0]> = {}
) {
  return {
    versionKind: "sent",
    frozenAt: "2026-08-16T12:00:00.000Z",
    acceptedVersionId: IDS.v5,
    latestSentVersionId: IDS.v5,
    acceptedOptionId: IDS.option,
    frozenSelectedOptionId: IDS.option,
    proposalId: IDS.proposal,
    jobActiveProposalId: IDS.proposal,
    jobId: IDS.job,
    proposalJobId: IDS.job,
    companyId: IDS.company,
    proposalCompanyId: IDS.company,
    jobCompanyId: IDS.company,
    draftContentChangedAt: "2026-08-16T12:00:00.000Z",
    canonicalJobStage: "proposal",
    jobDisposition: "active",
    hasConflictingAcceptance: false,
    ...overrides,
  };
}

describe("R3C classifier", () => {
  test("CLEAN latest-sent frozen version is VALID_CLEAN, not automatic approval", () => {
    assert.deepEqual(classifyProposalAcceptanceGuard(cleanInput()), {
      result: "valid_clean",
      reason: null,
    });
  });

  test("DIRTY revision is VALID_REVIEW_REQUIRED", () => {
    const frozenAt = "2026-08-16T12:00:00.000Z";
    const draftContentChangedAt = "2026-08-16T13:00:00.000Z";
    assert.equal(
      isMutableDraftDirtyAfterSentFreeze({ draftContentChangedAt, latestSentFrozenAt: frozenAt }),
      true
    );
    assert.deepEqual(
      classifyProposalAcceptanceGuard(cleanInput({ draftContentChangedAt })),
      { result: "valid_review_required", reason: "dirty_revision" }
    );
  });

  test("OLDER sent version is VALID_REVIEW_REQUIRED and stays bound to that version", () => {
    assert.deepEqual(
      classifyProposalAcceptanceGuard(
        cleanInput({
          acceptedVersionId: IDS.v5,
          latestSentVersionId: IDS.v6,
        })
      ),
      {
        result: "valid_review_required",
        reason: "older_sent_version",
      }
    );
  });

  test("INVALID draft, mismatch, and non-selected option", () => {
    assert.equal(
      classifyProposalAcceptanceGuard(cleanInput({ versionKind: "draft" })).result,
      "invalid"
    );
    assert.equal(
      classifyProposalAcceptanceGuard(
        cleanInput({ frozenSelectedOptionId: "00000000-0000-4000-8000-000000000000" })
      ).reason,
      "option_not_selected_frozen"
    );
    assert.equal(
      classifyProposalAcceptanceGuard(cleanInput({ proposalJobId: IDS.v5 })).reason,
      "job_mismatch"
    );
  });

  test("lost, closed, and on_hold are review-required, never automatic approval", () => {
    assert.deepEqual(
      classifyProposalAcceptanceGuard(cleanInput({ jobDisposition: "lost" })),
      { result: "valid_review_required", reason: "lost" }
    );
    assert.deepEqual(
      classifyProposalAcceptanceGuard(cleanInput({ jobDisposition: "closed" })),
      { result: "valid_review_required", reason: "closed" }
    );
    assert.deepEqual(
      classifyProposalAcceptanceGuard(cleanInput({ jobDisposition: "on_hold" })),
      { result: "valid_review_required", reason: "on_hold" }
    );
  });

  test("later operational stages classify as job_already_approved, not invalid", () => {
    for (const stage of ["approved", "scheduled", "production", "complete"] as const) {
      assert.deepEqual(
        classifyProposalAcceptanceGuard(
          cleanInput({
            canonicalJobStage: stage,
            acceptedVersionId: IDS.v5,
            latestSentVersionId: IDS.v6,
          })
        ),
        { result: "valid_review_required", reason: "job_already_approved" }
      );
    }
  });

  test("lost/closed still win over later-stage so disposition remains visible", () => {
    assert.deepEqual(
      classifyProposalAcceptanceGuard(
        cleanInput({ canonicalJobStage: "scheduled", jobDisposition: "lost" })
      ),
      { result: "valid_review_required", reason: "lost" }
    );
    assert.deepEqual(
      classifyProposalAcceptanceGuard(
        cleanInput({ canonicalJobStage: "complete", jobDisposition: "closed" })
      ),
      { result: "valid_review_required", reason: "closed" }
    );
  });

  test("later-stage on_hold classifies as job_already_approved, not on_hold", () => {
    assert.deepEqual(
      classifyProposalAcceptanceGuard(
        cleanInput({ canonicalJobStage: "production", jobDisposition: "on_hold" })
      ),
      { result: "valid_review_required", reason: "job_already_approved" }
    );
  });
});

describe("R3C migration 040 schema and ownership", () => {
  test("uses 040 and does not steal reserved 039", () => {
    assert.match(MIGRATION_040, /20260816_040_proposal_formal_acceptance\.sql$/);
    try {
      readFileSync(MIGRATION_039, "utf8");
      assert.fail("039 must remain unused for deferred C4 mint hardening");
    } catch (error) {
      assert.equal((error as NodeJS.ErrnoException).code, "ENOENT");
    }
    assert.match(sql040, /039 remains reserved for deferred C4/);
  });

  test("creates immutable proposal_acceptances with logical uniqueness", () => {
    assert.match(sql040, /create table if not exists public\.proposal_acceptances/);
    assert.match(
      sql040,
      /constraint proposal_acceptances_logical_unique\s+unique \(company_id, proposal_id, proposal_version_id, proposal_option_id\)/
    );
    assert.doesNotMatch(sql040, /constraint proposal_acceptances_token_unique/);
    assert.match(sql040, /proposal_acceptances rows cannot be deleted/);
    assert.match(sql040, /proposal_acceptances identity and evidence fields are immutable/);
    assert.match(sql040, /confirmation fields cannot be rewritten/);
    assert.doesNotMatch(sql040, /signature_png|signature_data|signed_at/);
    assert.doesNotMatch(sql040, /deposit_|payment_intent|stripe/);
    assert.doesNotMatch(sql040, /scheduled_at|appointment/);
  });

  test("reuses existing public token assert and does not mint tokens", () => {
    assert.match(sql040, /proposal_assert_public_access_token_active_v1/);
    assert.doesNotMatch(sql040, /persist_proposal_send_freeze_v1/);
    assert.doesNotMatch(sql040, /mint_proposal_public_access_token/);
    assert.match(sql040, /if v_locked_token\.status = 'superseded'/);
    assert.match(sql040, /code', 'superseded'/);
  });

  test("public record RPC never changes jobs.stage", () => {
    assert.match(recordFn, /record_proposal_acceptance_v1/);
    assert.match(recordFn, /classify_proposal_acceptance_guard_v1/);
    assert.match(recordFn, /project_proposal_acceptance_attention_v1/);
    assert.match(recordFn, /job_stage_unchanged/);
    assert.doesNotMatch(recordFn, /job_lifecycle_apply_proposal_approved_from_acceptance_v1/);
    assert.doesNotMatch(recordFn, /update public\.jobs/);
    assert.doesNotMatch(recordFn, /stage_entered_at\s*=/);
    assert.doesNotMatch(recordFn, /p_mode,\s*'auto'/);
  });

  test("contractor Approve job owns Proposal→Approved", () => {
    assert.match(confirmFn, /job_lifecycle_apply_proposal_approved_from_acceptance_v1/);
    assert.match(confirmFn, /'confirm',\s*'contractor_approved'/);
    assert.match(confirmFn, /job_already_approved/);
    assert.match(sql040, /if v_mode <> 'confirm'/);
    assert.match(sql040, /set_config\('job_lifecycle\.allow_stage_write', '1', true\)/);
    assert.match(sql040, /stage = 'approved'/);
    assert.match(sql040, /stage_entered_at = v_now/);
  });

  test("direct transition_job_stage_v1 remains blocked without acceptance", () => {
    assert.match(sql038, /approved_blocked_until_r3c/);
    assert.doesNotMatch(sql040, /create or replace function public\.transition_job_stage_v1/);
    assert.equal(JOB_LIFECYCLE_APPROVED_TRANSITIONS_ENABLED, false);
    assert.equal(isAllowedStageEdge("proposal", "approved"), false);
    assert.equal(TRANSITION_JOB_STAGE_RPC_V1, "transition_job_stage_v1");
    assert.equal(RECORD_PROPOSAL_ACCEPTANCE_RPC_V1, "record_proposal_acceptance_v1");
    assert.equal(CONFIRM_PROPOSAL_ACCEPTANCE_RPC_V1, "confirm_proposal_acceptance_v1");
  });

  test("every valid acceptance projects Attention", () => {
    assert.match(sql040, /acceptance_confirmation_required/);
    assert.match(sql040, /source_type in \(\s*'proposal_customer_requests',\s*'proposal_acceptances'/);
    assert.match(sql040, /project_proposal_acceptance_attention_v1/);
    assert.match(
      sql040,
      /if v_acceptance\.guard_result not in \('valid_clean', 'valid_review_required'\)/
    );
    assert.match(sql040, /dedupe_key is distinct from\s+\('acceptance_confirmation:proposal_acceptances:'/);
    assert.equal(PROPOSAL_ACCEPTANCE_ATTENTION_TYPE, "acceptance_confirmation_required");
  });

  test("security: no anon/authenticated table writes; public accept is service_role", () => {
    assert.match(sql040, /alter table public\.proposal_acceptances enable row level security/);
    assert.match(sql040, /grant select on table public\.proposal_acceptances to authenticated/);
    assert.match(sql040, /grant all on table public\.proposal_acceptances to service_role/);
    assert.match(
      sql040,
      /revoke all on function public\.record_proposal_acceptance_v1\(text, text, text, jsonb\)\s+from authenticated/
    );
    assert.match(
      sql040,
      /grant execute on function public\.record_proposal_acceptance_v1\(text, text, text, jsonb\)\s+to service_role/
    );
    assert.doesNotMatch(
      sql040,
      /grant execute on function public\.record_proposal_acceptance_v1\(text, text, text, jsonb\)\s+to authenticated/
    );
    assert.doesNotMatch(
      sql040,
      /grant execute on function public\.record_proposal_acceptance_v1\(text, text, text, jsonb\)\s+to anon/
    );
    assert.match(
      sql040,
      /grant execute on function public\.confirm_proposal_acceptance_v1\(jsonb\) to authenticated/
    );
    assert.doesNotMatch(sql040, /grant insert on table public\.proposal_acceptances/);
    assert.doesNotMatch(sql040, /grant update on table public\.proposal_acceptances/);
    assert.doesNotMatch(sql040, /grant delete on table public\.proposal_acceptances/);
    assert.match(
      sql040,
      /revoke all on function public\.job_lifecycle_apply_proposal_approved_from_acceptance_v1[\s\S]*from authenticated/
    );
  });

  test("does not mutate selected_option_id or invent a second proposal status", () => {
    assert.match(sql040, /formal acceptance must not mutate proposals\.selected_option_id/);
    assert.doesNotMatch(sql040, /set\s+selected_option_id\s*=/);
    assert.doesNotMatch(sql040, /proposals\.status\s*=/);
    assert.doesNotMatch(sql040, /create table if not exists public\.proposal_statuses/);
  });

  test("does not author C4 mint hardening or change freeze/pricing", () => {
    assert.doesNotMatch(sql040, /create or replace function public\.mint_proposal_public_access/);
    assert.doesNotMatch(sql040, /add column if not exists token_category/);
    assert.doesNotMatch(sql040, /update public\.proposal_versions/);
    assert.doesNotMatch(sql040, /update public\.proposal_options/);
  });

  test("disposition policy is explicit in SQL", () => {
    assert.match(sql040, /'reason', 'lost'/);
    assert.match(sql040, /'reason', 'closed'/);
    assert.match(sql040, /disposition_blocks_approval/);
    assert.match(sql040, /if v_job\.status in \('lost', 'closed'\)/);
    assert.match(sql040, /if v_job\.status = 'on_hold'/);
    assert.doesNotMatch(sql040, /lost_or_closed/);
  });

  test("runtime has no automatic approval path", () => {
    assert.doesNotMatch(sql040, /auto_approve/i);
    assert.doesNotMatch(sql040, /confirm_required/);
    assert.doesNotMatch(recordFn, /stage = 'approved'/);
    assert.match(sql040, /There is no automatic Proposal → Approved/);
  });
});

describe("R3C request vs acceptance and contractor UX", () => {
  test("Request this package remains a separate owner", () => {
    assert.notEqual(
      RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1,
      RECORD_PROPOSAL_ACCEPTANCE_RPC_V1
    );
    assert.equal(PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA, "Request this package");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_ACCEPT_PROPOSAL_CTA, "Accept proposal");
  });

  test("customer confirmed state does not expose contractor workflow", () => {
    const actions = readFileSync(
      join(ROOT, "app/components/proposal-packet/ProposalPacketCustomerActions.tsx"),
      "utf8"
    );
    const modal = readFileSync(
      join(ROOT, "app/components/proposal-packet/ProposalPacketAcceptModal.tsx"),
      "utf8"
    );
    assert.match(actions, /data-proposal-confirmed-state/);
    assert.match(actions, /PROPOSAL_CUSTOMER_PACKET_CONFIRMED_TITLE/);
    assert.doesNotMatch(actions, /ambiguous|Waiting for contractor|Pending approval|job stage/i);
    assert.doesNotMatch(modal, /ambiguous|Waiting for contractor|Review required/i);
    assert.equal(
      formatProposalCustomerAcceptedOnSentence("August 16, 2026"),
      "Confirmed on August 16, 2026"
    );
  });

  test("public accept API does not take a customer-chosen package id", () => {
    const route = readFileSync(join(ROOT, "app/api/proposals/accept/route.ts"), "utf8");
    assert.match(route, /recordProposalAcceptance/);
    assert.doesNotMatch(route, /requestedOptionId|selectedOptionId/);
    assert.match(route, /Does not accept a customer-chosen package/);
  });

  test("contractor Approve job is explicit operational approval", () => {
    const route = readFileSync(
      join(ROOT, "app/api/jobs/confirm-acceptance/route.ts"),
      "utf8"
    );
    const panel = readFileSync(
      join(ROOT, "app/tools/roofing/jobCard/JobCardNextActionPanel.tsx"),
      "utf8"
    );
    const client = readFileSync(
      join(ROOT, "app/tools/roofing/RoofingClient.tsx"),
      "utf8"
    );
    assert.match(route, /Contractor Approve job/);
    assert.match(panel, /Approve job/);
    assert.doesNotMatch(panel, /Confirm acceptance/);
    assert.equal(PROPOSAL_ACCEPTANCE_APPROVE_JOB_CTA, "Approve job");
    assert.match(sql040, /Does not rewrite acceptance onto latest_sent_version_id/);
    assert.match(client, /refreshHydratedJobRecord\(currentJobId\)/);
  });

  test("clean Attention copy is package and amount, not warning language", () => {
    assert.equal(
      formatProposalAcceptanceAttentionDetail({
        packageLabel: "Premium",
        acceptedTotalCents: 1850000,
      }),
      "Premium · $18,500"
    );
    assert.equal(
      formatProposalAcceptanceAttentionDetail({
        ambiguityReason: "older_sent_version",
        packageLabel: "Premium",
        acceptedTotalCents: 1850000,
      }),
      "Customer accepted an earlier proposal"
    );
    assert.equal(
      formatProposalAcceptanceAttentionDetail({
        ambiguityReason: "dirty_revision",
      }),
      "Customer accepted while a newer revision is in progress"
    );
    assert.equal(
      formatProposalAcceptanceAttentionDetail({ ambiguityReason: "lost" }),
      "Job is currently Lost"
    );
    assert.equal(
      formatProposalAcceptanceAttentionDetail({ ambiguityReason: "closed" }),
      "Job is currently Closed"
    );
  });

  test("same-version second token reuses logical acceptance", () => {
    assert.match(recordFn, /proposal_version_id = v_proposal_version_id/);
    assert.match(recordFn, /proposal_option_id = v_frozen\.option_id/);
    assert.match(recordFn, /when unique_violation then/);
    assert.match(sql040, /Same-version resend tokens reuse the logical row/);
  });

  test("already-Approved later acceptance has Acknowledge, not Approve job", () => {
    const panel = readFileSync(
      join(ROOT, "app/tools/roofing/jobCard/JobCardNextActionPanel.tsx"),
      "utf8"
    );
    const route = readFileSync(
      join(ROOT, "app/api/jobs/acknowledge-acceptance/route.ts"),
      "utf8"
    );
    const client = readFileSync(
      join(ROOT, "app/tools/roofing/RoofingClient.tsx"),
      "utf8"
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "proposal",
        jobDisposition: "active",
      }),
      "approve_job"
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "approved",
        jobDisposition: "active",
      }),
      "acknowledge"
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "scheduled",
        jobDisposition: "active",
      }),
      "acknowledge"
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "production",
        jobDisposition: "active",
      }),
      "acknowledge"
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "complete",
        jobDisposition: "active",
      }),
      "acknowledge"
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "scheduled",
        jobDisposition: "lost",
      }),
      "disposition_blocked"
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "proposal",
        jobDisposition: "lost",
      }),
      "disposition_blocked"
    );
    assert.equal(PROPOSAL_ACCEPTANCE_ACKNOWLEDGE_CTA, "Acknowledge");
    assert.match(panel, /showAcknowledge/);
    assert.match(panel, /data-attention-acknowledge-acceptance/);
    assert.match(panel, />\s*Acknowledge\s*</);
    assert.match(panel, /showApproveJob/);
    assert.match(route, /acknowledgeProposalAcceptanceViaRpc/);
    assert.match(route, /Does not Approve job and does not set confirmed_at/);
    assert.match(client, /\/api\/jobs\/acknowledge-acceptance/);
    assert.match(client, /onAcknowledgeAcceptance=\{acknowledgeAcceptance\}/);
    assert.equal(
      formatProposalAcceptanceAttentionDetail({
        ambiguityReason: "job_already_approved",
        packageLabel: "Premium",
        acceptedTotalCents: 1850000,
        acceptedAt: "2026-08-16T12:00:00.000Z",
      }),
      "Premium · $18,500 · Aug 16, 2026"
    );
  });

  test("acknowledge RPC resolves Attention without mutating confirmation or stage", () => {
    assert.equal(
      ACKNOWLEDGE_PROPOSAL_ACCEPTANCE_ATTENTION_RPC_V1,
      "acknowledge_proposal_acceptance_attention_v1"
    );
    assert.match(ackFn, /later_acceptance_acknowledged/);
    assert.match(ackFn, /approve_job_required/);
    assert.match(
      ackFn,
      /v_canonical not in \('approved', 'scheduled', 'production', 'complete'\)/
    );
    assert.match(ackFn, /acknowledge_not_available/);
    assert.doesNotMatch(ackFn, /update public\.proposal_acceptances/);
    assert.doesNotMatch(ackFn, /update public\.jobs/);
    assert.doesNotMatch(ackFn, /confirmed_at\s*=/);
    assert.doesNotMatch(ackFn, /job_lifecycle_apply_proposal_approved/);
    assert.match(
      sql040,
      /grant execute on function public\.acknowledge_proposal_acceptance_attention_v1\(jsonb\)\s+to authenticated/
    );
    assert.doesNotMatch(
      sql040,
      /grant execute on function public\.acknowledge_proposal_acceptance_attention_v1\(jsonb\)\s+to anon/
    );
    assert.match(recordFn, /if v_acceptance\.confirmed_at is null then/);
    assert.match(sql040, /v_canonical in \('approved', 'scheduled', 'production', 'complete'\)/);
    assert.match(ackFn, /company_memberships/);
    assert.match(ackFn, /idempotent', true/);
    assert.doesNotMatch(ackFn, /job_lifecycle_insert_activity/);
    assert.doesNotMatch(ackFn, /insert into public\.job_activity/);
    assert.doesNotMatch(ackFn, /insert into public\.proposal_acceptances/);
  });
});

describe("R3C later-stage historical awareness", () => {
  test("Proposal-stage clean acceptance still offers Approve job, not Acknowledge", () => {
    assert.deepEqual(classifyProposalAcceptanceGuard(cleanInput()), {
      result: "valid_clean",
      reason: null,
    });
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "proposal",
        jobDisposition: "active",
      }),
      "approve_job"
    );
    assert.notEqual(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "proposal",
        jobDisposition: "active",
      }),
      "acknowledge"
    );
  });

  test("lost/closed Proposal-stage still blocks Approve and does not expose Acknowledge", () => {
    assert.deepEqual(
      classifyProposalAcceptanceGuard(cleanInput({ jobDisposition: "lost" })),
      { result: "valid_review_required", reason: "lost" }
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "proposal",
        jobDisposition: "lost",
      }),
      "disposition_blocked"
    );
    assert.equal(
      resolveProposalAcceptanceAttentionAction({
        canonicalJobStage: "proposal",
        jobDisposition: "closed",
      }),
      "disposition_blocked"
    );
    assert.match(sql040, /disposition_blocks_approval/);
    assert.match(ackFn, /disposition_blocks_approval/);
    assert.match(sql040, /if v_job\.status in \('lost', 'closed'\)/);
    assert.doesNotMatch(sql040, /change_job_disposition_v1/);
  });

  test("later-stage different acceptance: Review + Acknowledge, no Approve job, no regression", () => {
    const panel = readFileSync(
      join(ROOT, "app/tools/roofing/jobCard/JobCardNextActionPanel.tsx"),
      "utf8"
    );
    for (const stage of ["approved", "scheduled", "production", "complete"] as const) {
      assert.equal(
        resolveProposalAcceptanceAttentionAction({
          canonicalJobStage: stage,
          jobDisposition: "active",
        }),
        "acknowledge"
      );
    }
    assert.equal(
      attentionHeadline({
        id: IDS.v5,
        jobId: IDS.job,
        proposalId: IDS.proposal,
        proposalVersionId: IDS.v6,
        attentionType: "acceptance_confirmation_required",
        sourceType: "proposal_acceptances",
        sourceId: IDS.option,
        status: "open",
        severity: "high",
        openedAt: "2026-08-16T12:00:00.000Z",
        acknowledgedAt: null,
        destination: {
          kind: "job_card_proposals",
          proposalId: IDS.proposal,
          proposalVersionId: IDS.v6,
          requestId: null,
          acceptanceId: IDS.option,
          tab: "proposals",
          anchor: "acceptance_confirmation",
        },
        request: null,
        acceptance: {
          acceptanceId: IDS.option,
          packageLabel: "Premium",
          acceptedTotalCents: 1850000,
          ambiguityReason: "job_already_approved",
          contractorReason: "Premium · $18,500 · Aug 16, 2026",
          reviewRequired: true,
          attentionAction: "acknowledge",
          acceptedAt: "2026-08-16T12:00:00.000Z",
          acceptedByName: null,
          acceptedByEmail: null,
        },
        personalReadAt: null,
        personalLastViewedAt: null,
      }),
      "Customer accepted another proposal version"
    );
    assert.match(panel, /Review accepted version/);
    assert.match(panel, /showAcknowledge \|\| selectedItem\.acceptance\?\.reviewRequired/);
    assert.match(panel, /showApproveJob \? \(/);
    assert.match(panel, /: showAcknowledge \? \(/);
    assert.doesNotMatch(panel, /Approve job[\s\S]*Acknowledge[\s\S]*Approve job/);
    assert.doesNotMatch(recordFn, /update public\.jobs/);
    assert.doesNotMatch(recordFn, /stage_entered_at\s*=/);
    assert.doesNotMatch(ackFn, /update public\.jobs/);
    assert.doesNotMatch(ackFn, /stage_entered_at\s*=/);
    assert.doesNotMatch(ackFn, /confirmed_at\s*=/);
    assert.match(ackFn, /j\.stage is distinct from v_before_stage/);
    assert.match(ackFn, /j\.stage_entered_at is distinct from v_before_entered/);
    assert.match(ackFn, /j\.status is distinct from v_before_status/);
    assert.match(ackFn, /a\.confirmed_at is distinct from v_before_confirmed/);
  });

  test("Approve job cannot become the later-acceptance confirmed basis", () => {
    assert.match(
      confirmFn,
      /v_canonical in \('approved', 'scheduled', 'production', 'complete'\)/
    );
    assert.match(confirmFn, /code', 'job_already_approved'/);
    assert.match(sql040, /if v_from <> 'proposal'/);
    assert.match(sql040, /'code', 'illegal_edge'/);
    assert.match(sql040, /if v_from = 'approved'/);
  });

  test("same logical acceptance retry creates no new row regardless of later stage", () => {
    assert.match(
      sql040,
      /constraint proposal_acceptances_logical_unique\s+unique \(company_id, proposal_id, proposal_version_id, proposal_option_id\)/
    );
    assert.match(recordFn, /v_idempotent_replay := true/);
    assert.match(recordFn, /when unique_violation then/);
    assert.match(
      sql040,
      /if found then[\s\S]*'projected', false/
    );
  });

  test("already-confirmed Approve job retry returns current canonical stage", () => {
    const route = readFileSync(
      join(ROOT, "app/api/jobs/confirm-acceptance/route.ts"),
      "utf8"
    );
    assert.match(confirmIdempotent, /canonical_job_stage_from_row/);
    assert.match(confirmIdempotent, /'job_stage', v_canonical/);
    assert.doesNotMatch(confirmIdempotent, /'job_stage', 'approved'/);
    assert.doesNotMatch(confirmFn, /'job_stage', 'approved'/);
    assert.doesNotMatch(confirmIdempotent, /update public\.jobs/);
    assert.doesNotMatch(confirmIdempotent, /update public\.proposal_acceptances/);
    assert.doesNotMatch(confirmIdempotent, /update public\.job_attention_items/);
    assert.doesNotMatch(confirmIdempotent, /job_lifecycle_insert_activity/);
    assert.doesNotMatch(confirmIdempotent, /stage_entered_at\s*=/);
    assert.match(confirmIdempotent, /'stage_entered_at', v_job\.stage_entered_at/);
    assert.match(route, /NextResponse\.json\(result\)/);
    assert.doesNotMatch(route, /job_stage\s*[:=].*approved/);

    for (const stage of ["approved", "scheduled", "production", "complete"] as const) {
      const parsed = parseConfirmProposalAcceptanceResult({
        ok: true,
        idempotent: true,
        acceptance_id: IDS.option,
        proposal_version_id: IDS.v5,
        proposal_option_id: IDS.option,
        guard_result: "valid_clean",
        ambiguity_reason: null,
        confirmed_at: "2026-08-16T12:00:00.000Z",
        confirmed_by_user_id: IDS.company,
        attention_id: null,
        job_stage: stage,
        stage_entered_at: "2026-08-10T12:00:00.000Z",
      });
      assert.equal(parsed.ok, true);
      if (parsed.ok) {
        assert.equal(parsed.idempotent, true);
        assert.equal(parsed.job_stage, stage);
        assert.equal(parsed.stage_entered_at, "2026-08-10T12:00:00.000Z");
      }
    }
  });

  test("later-stage lost/closed can subsequently Acknowledge after disposition permits", () => {
    const dispositionFn = sql038.slice(
      sql038.indexOf("create or replace function public.change_job_disposition_v1"),
      sql038.indexOf("comment on function public.change_job_disposition_v1")
    );
    for (const stage of ["approved", "scheduled", "production", "complete"] as const) {
      assert.equal(
        resolveProposalAcceptanceAttentionAction({
          canonicalJobStage: stage,
          jobDisposition: "lost",
        }),
        "disposition_blocked"
      );
      assert.equal(
        resolveProposalAcceptanceAttentionAction({
          canonicalJobStage: stage,
          jobDisposition: "closed",
        }),
        "disposition_blocked"
      );
      assert.equal(
        resolveProposalAcceptanceAttentionAction({
          canonicalJobStage: stage,
          jobDisposition: "active",
        }),
        "acknowledge"
      );
    }
    assert.match(ackFn, /if v_job\.status in \('lost', 'closed'\)/);
    assert.match(ackFn, /disposition_blocks_approval/);
    assert.match(
      ackFn,
      /v_canonical not in \('approved', 'scheduled', 'production', 'complete'\)/
    );
    assert.match(dispositionFn, /status = v_to/);
    assert.doesNotMatch(dispositionFn, /stage = /);
    assert.doesNotMatch(dispositionFn, /stage_entered_at = /);
    assert.match(dispositionFn, /stage_unchanged/);
  });
});
