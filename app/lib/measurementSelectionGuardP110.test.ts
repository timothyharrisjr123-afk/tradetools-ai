import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const GUARD = readFileSync(
  join(ROOT, "supabase/migrations/20260910174500_guard_measurement_is_selected_writes.sql"),
  "utf8"
);
const GATE_FIX = readFileSync(
  join(ROOT, "supabase/migrations/20260910180200_fix_measurement_selection_allow_gate.sql"),
  "utf8"
);
const OPS = readFileSync(
  join(ROOT, "scripts/ops/20260910_production_fd_p1_10_flag_pointer_remediation.sql"),
  "utf8"
);
const STORE = readFileSync(join(ROOT, "app/lib/measurementStore.ts"), "utf8");

describe("FD-P1-10 measurement selection write guard", () => {
  test("raw is_selected mutations require the selection allow gate", () => {
    assert.match(GUARD, /measurement_records_guard_is_selected_v1/i);
    assert.match(GUARD, /measurement_selection_must_use_rpc/i);
    assert.match(GUARD, /fielddive\.allow_measurement_selection/i);
    assert.match(GUARD, /BEFORE INSERT OR UPDATE OF is_selected/i);
  });

  test("authorized RPC and jobs pointer sync set the allow gate", () => {
    assert.match(
      GUARD,
      /select_job_measurement_v1[\s\S]*set_config\('fielddive\.allow_measurement_selection', '1', true\)/i
    );
    assert.match(
      GUARD,
      /jobs_validate_selected_measurement_v1[\s\S]*set_config\('fielddive\.allow_measurement_selection', '1', true\)/i
    );
  });

  test("jobs pointer sync clears the allow gate after flag updates", () => {
    assert.match(
      GATE_FIX,
      /set_config\('fielddive\.allow_measurement_selection', '1', true\)[\s\S]*set_config\('fielddive\.allow_measurement_selection', '', true\)/i
    );
  });

  test("app still has no flag-only or pointer-only selection writers", () => {
    assert.match(STORE, /supabase\.rpc\("select_job_measurement_v1"/);
    assert.match(STORE, /delete \(row as \{ is_selected\?: boolean \}\)\.is_selected/);
    assert.match(STORE, /is_selected: false,/);
  });

  test("production remediation restores exactly six audited pointers fail-closed", () => {
    assert.equal((OPS.match(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi) ?? []).length >= 12, true);
    assert.match(OPS, /expected 6 audited jobs with NULL pointer/i);
    assert.match(OPS, /expected to update 6 jobs/i);
    assert.match(OPS, /flag_without_pointer remains/i);
    assert.doesNotMatch(OPS, /UPDATE public\.proposal_versions/i);
    assert.doesNotMatch(OPS, /UPDATE public\.measurement_records/i);
  });
});
