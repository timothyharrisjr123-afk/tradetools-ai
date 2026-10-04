/**
 * change_job_disposition_v1 — authority and transition behavior.
 *
 * The current definition is 20261002120000_core_disposition_authority_and_job_write_boundary.sql.
 * It enforces the exact capability for the transition under the Job row lock and the locks:
 * Lost any time before Complete, Lost requires a reason, Complete never becomes Lost, Lost is
 * terminal. Crew lifecycle ending lives in the jobs trigger (phase13cCrewLifecycleProjection.test.ts),
 * never in this function. Live staging proof: hold-only / finalize actors over authenticated RPC.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  capabilityForDispositionTransition,
  dispositionTransitionDenial,
} from "./jobDispositionAuthority";
import { statusForDispositionCode } from "./jobDispositionManagement";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const CURRENT_NAME = "20261002120000_core_disposition_authority_and_job_write_boundary.sql";
const HEADER = "CREATE OR REPLACE FUNCTION public.change_job_disposition_v1(p_payload jsonb)";

function disposition(sql: string): string {
  const start = sql.indexOf(HEADER);
  assert.ok(start >= 0);
  const end = sql.indexOf("$function$;", start);
  assert.ok(end > start);
  return sql.slice(start, end + "$function$;".length);
}

const CURRENT_SQL = read(`supabase/migrations/${CURRENT_NAME}`);
const FN = disposition(CURRENT_SQL);
const at = (needle: string) => {
  const index = FN.indexOf(needle);
  assert.ok(index >= 0, needle);
  return index;
};

describe("authoritative definition", () => {
  test("the core authority migration holds the latest definition", () => {
    const names = readdirSync(join(ROOT, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
    const defining = names.filter((name) =>
      /create or replace function "?public"?\."?change_job_disposition_v1/i.test(read(`supabase/migrations/${name}`))
    );
    assert.equal(defining.at(-1), CURRENT_NAME);
  });

  test("SECURITY DEFINER, no Crew writes, and the existing ACL is not re-issued", () => {
    assert.match(FN, /SECURITY DEFINER/);
    assert.doesNotMatch(FN, /job_crew_assignments/);
    assert.doesNotMatch(FN, /job_schedules/);
    assert.doesNotMatch(CURRENT_SQL, /(grant|revoke)[^;]*change_job_disposition_v1/i);
  });
});

describe("authority: exact capability for the transition, under the Job lock", () => {
  test("the broad hold-OR-finalize gate is gone", () => {
    assert.doesNotMatch(FN, /member_can_v1\('jobs\.hold'\)\s+or\s+private\.member_can_v1\('jobs\.finalize'\)/);
    assert.doesNotMatch(FN, /or private\.member_can_v1/);
  });

  test("active membership in the payload company is required before the Job is read", () => {
    assert.match(
      FN,
      /where cm\.company_id = v_company_id\s+and cm\.user_id = v_uid\s+and cm\.removed_at is null\s+\) into v_member;/
    );
    assert.ok(at("into v_member;") < at("for update;"));
  });

  test("capability is derived from the locked status and checked job-scoped before any write", () => {
    const lock = at("for update;");
    const derive = at("if v_to in ('lost', 'closed') or v_job.status in ('lost', 'closed') then");
    const check = at("if not private.member_can_v1(v_capability, v_job.id) then");
    assert.ok(lock < derive && derive < check);
    assert.ok(check < at("if v_job.status = v_to then"));
    assert.ok(check < at("perform set_config('job_lifecycle.allow_status_write', '1', true);"));
    assert.match(FN, /v_capability := 'jobs\.finalize';\n  else\n    v_capability := 'jobs\.hold';/);
  });

  test("route mapping matches the database mapping", () => {
    const cases: Array<[string, "active" | "on_hold" | "lost" | "closed", string]> = [
      ["active", "on_hold", "jobs.hold"],
      ["on_hold", "active", "jobs.hold"],
      ["active", "active", "jobs.hold"],
      ["active", "lost", "jobs.finalize"],
      ["on_hold", "lost", "jobs.finalize"],
      ["active", "closed", "jobs.finalize"],
      ["on_hold", "closed", "jobs.finalize"],
      ["closed", "active", "jobs.finalize"],
      ["closed", "on_hold", "jobs.finalize"],
      ["lost", "active", "jobs.finalize"],
      ["lost", "on_hold", "jobs.finalize"],
    ];
    for (const [from, to, cap] of cases) {
      assert.equal(capabilityForDispositionTransition(from, to), cap, `${from}→${to}`);
    }
  });

  test("a hold-only actor cannot reach Lost or Closed, or leave Closed", () => {
    const holdOnly = new Set(["jobs.hold"]);
    for (const [from, to] of [
      ["active", "lost"],
      ["on_hold", "lost"],
      ["active", "closed"],
      ["on_hold", "closed"],
      ["closed", "on_hold"],
      ["closed", "active"],
    ] as const) {
      assert.equal(holdOnly.has(capabilityForDispositionTransition(from, to)), false, `${from}→${to}`);
    }
  });

  test("a hold holder can still pause and resume", () => {
    assert.equal(capabilityForDispositionTransition("active", "on_hold"), "jobs.hold");
    assert.equal(capabilityForDispositionTransition("on_hold", "active"), "jobs.hold");
  });
});

describe("transition locks", () => {
  test("Lost is terminal (permanent Lost Reopen is superseded)", () => {
    assert.match(FN, /if v_job\.status = 'lost' then\n    return jsonb_build_object\('ok', false, 'code', 'lost_is_terminal'\);/);
    for (const to of ["active", "on_hold", "closed"] as const) {
      assert.equal(
        dispositionTransitionDenial({ fromStatus: "lost", toStatus: to, stage: "proposal", reason: "x" }),
        "lost_is_terminal"
      );
    }
  });

  test("Complete can never become Lost", () => {
    assert.match(FN, /if v_to = 'lost' and v_job\.stage = 'complete' then\n    return jsonb_build_object\('ok', false, 'code', 'complete_cannot_be_lost'\);/);
    for (const from of ["active", "on_hold", "closed"]) {
      assert.equal(
        dispositionTransitionDenial({ fromStatus: from, toStatus: "lost", stage: "complete", reason: "x" }),
        "complete_cannot_be_lost"
      );
    }
  });

  test("Lost requires a non-blank reason", () => {
    assert.match(FN, /v_reason := nullif\(btrim\(coalesce\(p_payload->>'reason', ''\)\), ''\);/);
    assert.match(FN, /if v_to = 'lost' and v_reason is null then\n    return jsonb_build_object\('ok', false, 'code', 'lost_reason_required'\);/);
    for (const reason of [null, "", "   "]) {
      assert.equal(
        dispositionTransitionDenial({ fromStatus: "active", toStatus: "lost", stage: "proposal", reason }),
        "lost_reason_required"
      );
    }
  });

  test("Lost is allowed any time before Complete with a reason", () => {
    for (const stage of ["intake", "proposal", "approved", "scheduled", "production"]) {
      for (const from of ["active", "on_hold"]) {
        assert.equal(
          dispositionTransitionDenial({ fromStatus: from, toStatus: "lost", stage, reason: "Went with another roofer" }),
          null,
          `${from}@${stage}`
        );
      }
    }
  });

  test("hold, resume, close, and Closed reopen are not blocked by the Lost locks", () => {
    const allowed = [
      ["active", "on_hold", "production"],
      ["on_hold", "active", "production"],
      ["active", "closed", "complete"],
      ["closed", "active", "production"],
    ] as const;
    for (const [from, to, stage] of allowed) {
      assert.equal(dispositionTransitionDenial({ fromStatus: from, toStatus: to, stage, reason: null }), null);
    }
  });

  test("same-target replay is idempotent and evaluated after authority, before the locks", () => {
    assert.equal(dispositionTransitionDenial({ fromStatus: "lost", toStatus: "lost", stage: "complete", reason: null }), null);
    const replay = at("if v_job.status = v_to then");
    assert.ok(replay < at("if v_job.status = 'lost' then"));
    assert.ok(replay < at("if v_to = 'lost' and v_job.stage = 'complete' then"));
    assert.ok(replay < at("if v_to = 'lost' and v_reason is null then"));
  });

  test("every lock returns before the status write", () => {
    const write = at("perform set_config('job_lifecycle.allow_status_write', '1', true);");
    for (const code of ["lost_is_terminal", "complete_cannot_be_lost", "lost_reason_required"]) {
      assert.ok(at(`'code', '${code}'`) < write, code);
    }
  });

  test("route statuses for the new codes", () => {
    assert.equal(statusForDispositionCode("lost_is_terminal"), 409);
    assert.equal(statusForDispositionCode("complete_cannot_be_lost"), 409);
    assert.equal(statusForDispositionCode("lost_reason_required"), 400);
    assert.equal(statusForDispositionCode("forbidden"), 403);
  });
});

describe("preserved behavior", () => {
  test("targets", () => {
    assert.match(FN, /if v_to in \('won', 'archived'\) then/);
    assert.match(FN, /if v_to not in \('active', 'on_hold', 'lost', 'closed'\) then/);
  });

  test("only status and last_activity_at are written; stage is preserved", () => {
    assert.match(FN, /update public\.jobs\n  set\n    status = v_to,\n    last_activity_at = v_now\n  where/);
    assert.match(FN, /'stage_unchanged', v_job\.stage/);
    assert.match(FN, /'stage_entered_at_unchanged', v_job\.stage_entered_at/);
  });

  test("Activity integrity: one disposition event with the reason", () => {
    assert.match(
      FN,
      /'from_status', v_job\.status,\n      'to_status', v_to,\n      'reason', v_reason,\n      'stage_unchanged', v_job\.stage,\n      'reopened', \(v_to = 'active' and v_job\.status is distinct from 'active'\)/
    );
    assert.equal([...FN.matchAll(/public\.job_lifecycle_insert_activity\(/g)].length, 1);
  });

  test("error codes", () => {
    const codes = new Set([...FN.matchAll(/'code', '([a-z_]+)'/g)].map((m) => m[1]));
    assert.deepEqual([...codes].sort(), [
      "complete_cannot_be_lost",
      "forbidden",
      "illegal_disposition_target",
      "invalid_payload",
      "lost_is_terminal",
      "lost_reason_required",
      "not_found",
      "unauthorized",
    ]);
  });

  test("return shape keys", () => {
    const finalReturn = FN.slice(FN.lastIndexOf("return jsonb_build_object("));
    const keys = [...finalReturn.matchAll(/'([a-z_]+)', /g)].map((m) => m[1]);
    assert.deepEqual(keys, ["ok", "idempotent", "job_id", "from_status", "to_status", "stage_unchanged", "stage_entered_at_unchanged", "activity_id"]);
  });
});
