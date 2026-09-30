/**
 * change_job_disposition_v1 redefinition for Job → Crew: exact-copy regression contract.
 * Every existing behavior is pinned to the 13B-C source; the only addition is ending
 * active Crew assignments on a transition to closed, inside the same transaction.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { capabilityForDispositionTransition } from "./jobDispositionAuthority";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const SOURCE_NAME = "20260927193000_phase13b_c_rpc_canonical_capabilities.sql";
const NEW_NAME = "20260930120000_phase13c_job_crew_assignments.sql";
const HEADER = "CREATE OR REPLACE FUNCTION public.change_job_disposition_v1(p_payload jsonb)";

function disposition(sql: string): string {
  const start = sql.indexOf(HEADER);
  assert.ok(start >= 0);
  const end = sql.indexOf("$function$;", start);
  assert.ok(end > start);
  return sql.slice(start, end + "$function$;".length);
}

const SOURCE = disposition(read(`supabase/migrations/${SOURCE_NAME}`));
const NEW_SQL = read(`supabase/migrations/${NEW_NAME}`);
const NEW = disposition(NEW_SQL);
const MARKED = /  -- phase13c job crew: begin\n[\s\S]*?  -- phase13c job crew: end\n\n?/g;
const ADDED = [...NEW.matchAll(MARKED)].map((m) => m[0]);
const CLOSED_BLOCK = ADDED[1] ?? "";
const STRIPPED = NEW.replace(MARKED, "");

describe("authoritative source", () => {
  test("13B-C is the latest definition before this migration, and this migration is the only later one", () => {
    const names = readdirSync(join(ROOT, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
    const defining = names.filter((name) =>
      /create or replace function "?public"?\."?change_job_disposition_v1/i.test(read(`supabase/migrations/${name}`))
    );
    assert.deepEqual(defining.slice(-2), [SOURCE_NAME, NEW_NAME]);
  });

  test("with the marked additions removed the function is byte-identical to the source", () => {
    assert.equal(STRIPPED, SOURCE);
  });

  test("there are exactly two additions: one variable and one closed-transition block", () => {
    assert.equal(ADDED.length, 2);
    assert.match(ADDED[0], /^  -- phase13c job crew: begin\n  v_crew_assignment public\.job_crew_assignments%rowtype;\n  -- phase13c job crew: end\n$/);
  });

  test("grants are not re-issued, so the existing ACL is preserved", () => {
    assert.doesNotMatch(NEW_SQL, /(grant|revoke)[^;]*change_job_disposition_v1/i);
  });
});

describe("only new behavior: closing ends every active Crew assignment atomically", () => {
  test("runs only for a transition to closed", () => {
    assert.match(CLOSED_BLOCK, /^  -- phase13c job crew: begin\n  if v_to = 'closed' then\n/);
  });

  test("ends primary and non-primary active rows of this job with job_closed at the same instant by the actor", () => {
    assert.match(CLOSED_BLOCK, /set ended_at = v_now, ended_by = v_uid, end_reason = 'job_closed'/);
    assert.match(CLOSED_BLOCK, /where a\.company_id = v_company_id\s+and a\.job_id = v_job_id\s+and a\.ended_at is null/);
    assert.doesNotMatch(CLOSED_BLOCK, /is_primary\s*(=|and|\n\s*and)|a\.is_primary(?!,)/);
  });

  test("writes one job_crew_assignment_ended event per ended row inside the function", () => {
    assert.match(CLOSED_BLOCK, /for v_crew_assignment in\s+update public\.job_crew_assignments a[\s\S]*returning a\.\*\s+loop\s+perform public\.job_lifecycle_insert_activity\(/);
    assert.match(CLOSED_BLOCK, /'job_crew_assignment_ended'/);
    assert.match(CLOSED_BLOCK, /'end_reason', 'job_closed'/);
    assert.match(CLOSED_BLOCK, /v_now\n      \);\n    end loop;/);
  });

  test("runs after the status write and disposition event, before the unchanged return", () => {
    const blockAt = NEW.indexOf(CLOSED_BLOCK);
    assert.ok(NEW.indexOf("v_activity_id := public.job_lifecycle_insert_activity(") < blockAt);
    assert.ok(blockAt < NEW.lastIndexOf("return jsonb_build_object("));
  });

  test("a same-status closed call returns before the block and ends nothing", () => {
    const idempotent = NEW.indexOf("if v_job.status = v_to then");
    const idempotentReturn = NEW.indexOf("end if;", idempotent);
    assert.ok(idempotentReturn < NEW.indexOf(CLOSED_BLOCK));
  });
});

describe("existing behavior unchanged", () => {
  test("authority gate", () => {
    assert.match(STRIPPED, /and \(private\.member_can_v1\('jobs\.hold'\) or private\.member_can_v1\('jobs\.finalize'\)\)/);
    assert.equal(capabilityForDispositionTransition("active", "on_hold"), "jobs.hold");
    assert.equal(capabilityForDispositionTransition("on_hold", "active"), "jobs.hold");
    assert.equal(capabilityForDispositionTransition("active", "closed"), "jobs.finalize");
    assert.equal(capabilityForDispositionTransition("closed", "active"), "jobs.finalize");
    assert.equal(capabilityForDispositionTransition("active", "lost"), "jobs.finalize");
  });

  test("transitions and targets", () => {
    assert.match(STRIPPED, /if v_to in \('won', 'archived'\) then/);
    assert.match(STRIPPED, /if v_to not in \('active', 'on_hold', 'lost', 'closed'\) then/);
  });

  test("stage and stage_entered_at are preserved; only status and last_activity_at are written", () => {
    assert.match(STRIPPED, /update public\.jobs\n  set\n    status = v_to,\n    last_activity_at = v_now\n  where/);
    assert.match(STRIPPED, /'stage_unchanged', v_job\.stage/);
    assert.match(STRIPPED, /'stage_entered_at_unchanged', v_job\.stage_entered_at/);
  });

  test("reason and the disposition event payload", () => {
    assert.match(STRIPPED, /v_reason := nullif\(p_payload->>'reason', ''\);/);
    assert.match(STRIPPED, /'from_status', v_job\.status,\n      'to_status', v_to,\n      'reason', v_reason,\n      'stage_unchanged', v_job\.stage,\n      'reopened', \(v_to = 'active' and v_job\.status is distinct from 'active'\)/);
    assert.equal([...NEW.matchAll(/v_event_type text := 'disposition_changed'/g)].length, 1);
  });

  test("schedule untouched and reopen restores nothing", () => {
    assert.doesNotMatch(NEW, /job_schedules/);
    assert.doesNotMatch(NEW, /insert into public\.job_crew_assignments/);
    assert.doesNotMatch(CLOSED_BLOCK, /'active'/);
  });

  test("existing error codes", () => {
    for (const code of ["unauthorized", "invalid_payload", "illegal_disposition_target", "forbidden", "not_found"]) {
      assert.ok(STRIPPED.includes(`'code', '${code}'`), code);
    }
    const codes = new Set([...NEW.matchAll(/'code', '([a-z_]+)'/g)].map((m) => m[1]));
    assert.deepEqual([...codes].sort(), ["forbidden", "illegal_disposition_target", "invalid_payload", "not_found", "unauthorized"]);
  });

  test("return shape keys", () => {
    const finalReturn = NEW.slice(NEW.lastIndexOf("return jsonb_build_object("));
    const keys = [...finalReturn.matchAll(/'([a-z_]+)', /g)].map((m) => m[1]);
    assert.deepEqual(keys, ["ok", "idempotent", "job_id", "from_status", "to_status", "stage_unchanged", "stage_entered_at_unchanged", "activity_id"]);
  });

  test("Work Complete, Start, and On hold/Lost do not end assignments", () => {
    assert.doesNotMatch(NEW_SQL, /function public\.(complete_job_work_v1|start_job_work_v1)/i);
    assert.equal([...NEW.matchAll(/update public\.job_crew_assignments/g)].length, 1);
    assert.doesNotMatch(CLOSED_BLOCK, /on_hold|'lost'/);
  });
});
