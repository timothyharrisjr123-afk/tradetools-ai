import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MIGRATION = readFileSync(
  join(ROOT, "supabase/migrations/20260910130934_atomic_job_measurement_selection.sql"),
  "utf8"
);
const STORE = readFileSync(join(ROOT, "app/lib/measurementStore.ts"), "utf8");
const ROOFING = readFileSync(join(ROOT, "app/tools/roofing/RoofingClient.tsx"), "utf8");
const PREPARE = readFileSync(
  join(ROOT, "app/tools/roofing/jobCard/useJobCardPrepareProposal.ts"),
  "utf8"
);
const OPS = readFileSync(
  join(ROOT, "scripts/ops/20260910_production_measurement_pointer_remediation.sql"),
  "utf8"
);

describe("FD-P0-02 atomic measurement selection", () => {
  test("RPC is invoker-secured, membership checked, and explicitly granted", () => {
    assert.match(MIGRATION, /FUNCTION public\.select_job_measurement_v1\([\s\S]*SECURITY INVOKER/i);
    assert.match(MIGRATION, /SET search_path = pg_catalog, public/i);
    assert.match(MIGRATION, /auth\.uid\(\)/i);
    assert.match(MIGRATION, /public\.company_memberships/i);
    assert.match(MIGRATION, /REVOKE ALL ON FUNCTION public\.select_job_measurement_v1[\s\S]*FROM PUBLIC, anon/i);
    assert.match(MIGRATION, /GRANT EXECUTE ON FUNCTION public\.select_job_measurement_v1[\s\S]*TO authenticated, service_role/i);
  });

  test("RPC serializes on the job and locks measurement rows deterministically", () => {
    assert.match(MIGRATION, /FROM public\.jobs j[\s\S]*FOR UPDATE/i);
    assert.match(MIGRATION, /FROM public\.measurement_records m[\s\S]*ORDER BY m\.id[\s\S]*FOR UPDATE/i);
    assert.match(MIGRATION, /measurement_company_mismatch/i);
    assert.match(MIGRATION, /measurement_job_mismatch/i);
    assert.match(MIGRATION, /measurement_not_selectable/i);
  });

  test("one transaction synchronizes selected flags and the job pointer", () => {
    assert.match(MIGRATION, /UPDATE public\.measurement_records m[\s\S]*SET is_selected = false/i);
    assert.match(MIGRATION, /SET is_selected = true/i);
    assert.match(MIGRATION, /UPDATE public\.jobs j[\s\S]*SET selected_measurement_id = p_measurement_id/i);
    assert.match(MIGRATION, /p_measurement_id uuid DEFAULT NULL/i);
  });

  test("raw pointer enforcement rejects illegal ownership and synchronizes is_selected", () => {
    assert.match(MIGRATION, /jobs_validate_selected_measurement_v1/i);
    assert.match(MIGRATION, /selected_measurement_not_found/i);
    assert.match(MIGRATION, /v_measurement_company_id IS DISTINCT FROM NEW\.company_id/i);
    assert.match(MIGRATION, /v_measurement_job_id IS DISTINCT FROM NEW\.id/i);
    assert.match(MIGRATION, /FOREIGN KEY \(selected_measurement_id\)[\s\S]*ON DELETE SET NULL[\s\S]*NOT VALID/i);
    assert.doesNotMatch(MIGRATION, /VALIDATE CONSTRAINT jobs_selected_measurement_id_fkey/i);
    assert.match(
      MIGRATION,
      /NEW\.selected_measurement_id IS DISTINCT FROM OLD\.selected_measurement_id[\s\S]*SET is_selected = false/i
    );
    assert.match(
      MIGRATION,
      /NEW\.selected_measurement_id IS DISTINCT FROM OLD\.selected_measurement_id[\s\S]*SET is_selected = true/i
    );
  });

  test("the app has one selection writer and ordinary edits cannot set is_selected", () => {
    assert.match(STORE, /supabase\.rpc\("select_job_measurement_v1"/);
    assert.doesNotMatch(STORE, /\.update\(\{ is_selected: false \}\)/);
    assert.match(STORE, /delete \(row as \{ is_selected\?: boolean \}\)\.is_selected/);
    assert.match(STORE, /is_selected: false,/);
    assert.doesNotMatch(ROOFING, /updateJob\(jobId, \{ selected_measurement_id:/);
    assert.doesNotMatch(PREPARE, /updateJob\(jid, \{ selected_measurement_id:/);
    const JOB_STORE = readFileSync(join(ROOT, "app/lib/jobStore.ts"), "utf8");
    assert.doesNotMatch(
      JOB_STORE,
      /row\.selected_measurement_id = draft\.selected_measurement_id/
    );
  });

  test("production remediation is exact, fail-closed, and leaves history/owner selection untouched", () => {
    assert.equal((OPS.match(/'(?:b8635f31|662e8ed3|6fb015e6)-[0-9a-f-]{27}'/g) ?? []).length, 3);
    assert.match(OPS, /expected all 3 exact audited job pointers/i);
    assert.match(OPS, /a target job now has a legitimate local measurement/i);
    assert.match(OPS, /GET DIAGNOSTICS v_updated = ROW_COUNT/i);
    assert.match(OPS, /IF v_updated <> 3/i);
    assert.match(OPS, /owner measurement selection changed unexpectedly/i);
    assert.match(OPS, /VALIDATE CONSTRAINT jobs_selected_measurement_id_fkey/i);
    assert.doesNotMatch(OPS, /UPDATE public\.measurement_records/i);
    assert.doesNotMatch(OPS, /UPDATE public\.proposals|UPDATE public\.proposal_versions/i);
  });
});
