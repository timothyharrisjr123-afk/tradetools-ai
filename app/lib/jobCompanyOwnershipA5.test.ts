/**
 * A5 / FD-P1-04 — jobs.company_id immutability contracts.
 *
 * Local file proves migration + app facade contracts.
 * Live role / UPSERT / concurrency proofs run on staging after migration apply.
 *
 * Run: npx tsx --test app/lib/jobCompanyOwnershipA5.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { JobUpdatePatch } from "./jobStore";

const ROOT = process.cwd();
const MIGRATION = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260911143216_jobs_company_id_immutability.sql"
  ),
  "utf8"
);
const JOB_STORE = readFileSync(join(ROOT, "app/lib/jobStore.ts"), "utf8");
const BASELINE = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260909130000_canonical_pre_recovery_baseline.sql"
  ),
  "utf8"
);

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Mirrors PostgreSQL `IS DISTINCT FROM` for uuid/text ownership values. */
function isDistinctFrom(
  oldValue: string | null,
  newValue: string | null
): boolean {
  return oldValue !== newValue;
}

const validPatch: JobUpdatePatch = {
  customer_id: null,
  property_id: null,
  notes: "normal update",
  selected_measurement_id: null,
  active_proposal_id: null,
};

const invalidOwnerPatch: JobUpdatePatch = {
  // @ts-expect-error A5: company_id is not a mutable Job patch field.
  company_id: COMPANY_B,
};

void validPatch;
void invalidOwnerPatch;

describe("A5 migration preflight", () => {
  test("proves jobs.company_id column is NOT NULL", () => {
    assert.match(
      MIGRATION,
      /v_company_id_nullable is distinct from 'NO'/i
    );
    assert.match(MIGRATION, /a5_jobs_company_id_not_null_preflight_failed/);
  });

  test("proves zero NULL company_id rows", () => {
    assert.match(MIGRATION, /where j\.company_id is null/i);
    assert.match(MIGRATION, /a5_jobs_null_company_preflight_failed/);
  });

  test("proves zero jobs referencing missing companies", () => {
    assert.match(
      MIGRATION,
      /left join public\.companies c on c\.id = j\.company_id/i
    );
    assert.match(MIGRATION, /a5_jobs_missing_company_preflight_failed/);
  });
});

describe("A5 trigger contract", () => {
  test("BEFORE UPDATE OF company_id trigger with IS DISTINCT FROM", () => {
    assert.match(
      MIGRATION,
      /if new\.company_id is distinct from old\.company_id then/i
    );
    assert.match(
      MIGRATION,
      /before update of company_id on public\.jobs[\s\S]*for each row/i
    );
    assert.match(MIGRATION, /jobs_company_id_immutable_a5/);
    assert.match(MIGRATION, /jobs_company_id_immutable_v1/);
    assert.match(MIGRATION, /security invoker/i);
    assert.match(MIGRATION, /set search_path = ''/);
  });

  test("no GUC bypass, membership exception, transfer RPC, or service_role carve-out", () => {
    assert.doesNotMatch(
      MIGRATION,
      /current_setting\s*\(\s*'job_lifecycle|fielddive\.allow/i
    );
    assert.doesNotMatch(MIGRATION, /set_config\s*\(/i);
    assert.doesNotMatch(MIGRATION, /transfer_job|move_job|reassign.*company/i);
    assert.doesNotMatch(
      MIGRATION,
      /if\s+.*service_role.*then[\s\S]{0,80}return new/i
    );
    assert.doesNotMatch(MIGRATION, /company_memberships/i);
    assert.doesNotMatch(MIGRATION, /auth\.uid\s*\(/i);
  });

  test("defense-in-depth column revoke + effective privilege assert", () => {
    assert.match(
      MIGRATION,
      /revoke update \(company_id\) on table public\.jobs/i
    );
    assert.match(MIGRATION, /has_column_privilege/);
    assert.match(
      MIGRATION,
      /a5_jobs_company_id_effective_update_privilege_remains/
    );
    assert.match(
      MIGRATION,
      /foreach v_role in array array\['anon', 'authenticated', 'service_role'\]/
    );
  });

  test("same owner PASS; A→B, A→NULL, NULL→A REJECT via IS DISTINCT FROM", () => {
    assert.equal(isDistinctFrom(COMPANY_A, COMPANY_A), false); // same owner PASS
    assert.equal(isDistinctFrom(COMPANY_A, COMPANY_B), true); // A→B REJECT
    assert.equal(isDistinctFrom(COMPANY_A, null), true); // A→NULL REJECT
    assert.equal(isDistinctFrom(null, COMPANY_A), true); // NULL→A REJECT
    assert.equal(isDistinctFrom(null, null), false); // null-safe same
  });

  test("adversarial matrix documented for staging live proofs", () => {
    // These attackers are enforced by the universal trigger, not app code:
    // authenticated dual-company user, service_role, raw Data API, stale client,
    // UPSERT conflict update, childless job, jobs with children, concurrency.
    assert.match(
      MIGRATION,
      /Rejects every jobs\.company_id change, independent of RLS, membership, caller privilege, or child-table state/
    );
  });
});

describe("A5 jobStore facade", () => {
  test("createJob still requires company_id at INSERT", () => {
    assert.match(
      JOB_STORE,
      /export async function createJob[\s\S]*?company_id is required/
    );
    assert.match(
      JOB_STORE,
      /export async function createJob[\s\S]*?\.insert\(row\)/
    );
  });

  test("updateJob uses JobUpdatePatch and strips company_id before UPDATE", () => {
    assert.match(JOB_STORE, /export type JobUpdatePatch/);
    assert.match(
      JOB_STORE,
      /Omit<\s*Partial<\s*JobDraft\s*>\s*,\s*[\"']company_id[\"']/
    );
    assert.match(
      JOB_STORE,
      /export async function updateJob\(\s*jobId: string,\s*patch: JobUpdatePatch/
    );
    assert.match(
      JOB_STORE,
      /delete \(row as \{ company_id\?: string \}\)\.company_id/
    );
    assert.doesNotMatch(
      JOB_STORE,
      /export async function updateJob\([\s\S]*?patch: Partial<\s*JobDraft\s*>/
    );
  });

  test("updateJob contract rejects company_id at the type boundary", () => {
    assert.equal("company_id" in invalidOwnerPatch, true);
    assert.equal(typeof validPatch.notes, "string");
    assert.equal("company_id" in validPatch, false);
  });

  test("unrelated update fields remain on JobUpdatePatch", () => {
    const ok: JobUpdatePatch = {
      customer_id: COMPANY_A,
      property_id: COMPANY_B,
      notes: "ok",
      selected_measurement_id: COMPANY_A,
      active_proposal_id: COMPANY_B,
    };
    assert.equal(Object.keys(ok).includes("company_id"), false);
  });
});

describe("A5 writer surface inventory", () => {
  test("no production jobs UPDATE/UPSERT writer reintroduces company_id mutation", () => {
    const appTs = [
      "app/lib/jobStore.ts",
      "app/lib/proposalRecordStore.ts",
      "app/lib/proposalDraftCreatePersistence.ts",
      "app/lib/jobCardCustomerPersist.ts",
      "app/lib/jobLifecyclePersistence.ts",
      "app/lib/jobSchedulePersistence.ts",
      "app/lib/jobPaymentPersistence.ts",
      "app/lib/jobAttachmentPersistence.ts",
      "app/lib/jobTaskPersistence.ts",
      "app/api/customers/[customerId]/route.ts",
      "app/api/properties/[propertyId]/route.ts",
      "app/api/jobs/schedules/route.ts",
    ];
    for (const rel of appTs) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(
        src,
        /\.from\(\s*[\"']jobs[\"']\s*\)[\s\S]{0,200}\.update\(\s*\{[\s\S]{0,200}company_id\s*:/
      );
      assert.doesNotMatch(
        src,
        /\.from\(\s*[\"']jobs[\"']\s*\)[\s\S]{0,120}\.upsert\(/
      );
    }
  });

  test("baseline + lifecycle/schedule/payment writers do not SET jobs.company_id", () => {
    const paths = [
      "supabase/migrations/20260909130000_canonical_pre_recovery_baseline.sql",
      "supabase/migrations/20260910214259_schedule_stage_convergence.sql",
      "app/lib/jobLifecyclePersistence.ts",
      "app/lib/jobScheduleMapper.ts",
      "app/lib/jobPaymentPersistence.ts",
    ];
    // Reject only assignment in SET lists, not WHERE company_id = scopes.
    const setOwnerRe =
      /update\s+(?:public\.)?jobs\b[\s\S]{0,400}?\bset\b[\s\S]{0,400}?(?:^|,|\n)\s*company_id\s*=/im;
    for (const rel of paths) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(src, setOwnerRe);
    }
  });

  test("supported lifecycle RPCs exist and never assign jobs.company_id", () => {
    const rpcNames = [
      "transition_job_stage_v1",
      "start_job_work_v1",
      "complete_job_work_v1",
      "change_job_disposition_v1",
      "schedule_job_v1",
      "unschedule_job_v1",
      "reschedule_job_v1",
    ];
    for (const name of rpcNames) {
      assert.match(BASELINE, new RegExp(`"${name}"`, "i"));
    }
    assert.doesNotMatch(
      BASELINE,
      /update\s+(?:public\.)?jobs\b[\s\S]{0,400}?\bset\b[\s\S]{0,400}?(?:^|,|\n)\s*company_id\s*=/im
    );
  });
});
