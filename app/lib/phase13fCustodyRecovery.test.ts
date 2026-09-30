import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { readTeamSurfaceSource } from "./teamSurfaceSource.testSupport";

const root = join(__dirname, "..", "..");
const sql = readFileSync(
  join(root, "supabase/migrations/20260927220000_phase13b_f_custody_recovery.sql"),
  "utf8"
);
const persistence = readFileSync(join(root, "app/lib/companyMembershipPersistence.ts"), "utf8");
const editor = readTeamSurfaceSource(root);
const start = readFileSync(join(root, "app/start/page.tsx"), "utf8");
const evaluator = readFileSync(
  join(root, "supabase/migrations/20260927192000_phase13b_c_access_evaluator.sql"),
  "utf8"
);
const publicPage = readFileSync(join(root, "app/p/[token]/page.tsx"), "utf8");

test("assurance is aal2 within 15 minutes and is not a use-time gate", () => {
  assert.match(sql, /v_aal is distinct from 'aal2'/);
  assert.match(sql, /interval '15 minutes'/);
  assert.match(sql, /set_member_access assurance injection/);
  assert.match(sql, /issue_company_invitation assurance injection/);
  assert.doesNotMatch(evaluator, /assurance_satisfied_v1/);
  assert.doesNotMatch(sql, /evaluate_access_core_v1/);
});

test("transfer demotes before it promotes and support recovery is not a client RPC", () => {
  const apply = sql.slice(sql.indexOf("function private.apply_custody_transfer_v1"));
  const demote = apply.indexOf("set role = p_former_role");
  const promote = apply.indexOf("set role = 'owner'");
  assert.ok(demote > 0 && promote > demote);
  assert.match(sql, /lock_company_custody_v1/);
  assert.match(sql, /grant execute on function public.recover_company_custody_v1\(uuid, uuid, text, text, text\) to service_role/);
  assert.doesNotMatch(
    sql,
    /grant execute on function public.recover_company_custody_v1\(uuid, uuid, text, text, text\) to authenticated/
  );
  assert.match(sql, /member_reactivated/);
  assert.match(sql, /ownership_transferred/);
  assert.match(sql, /support_custody_recovered/);
});

test("reactivation revokes live grants before inserting the reviewed set", () => {
  const body = sql.slice(sql.indexOf("function public.reactivate_company_member_v1("));
  const revoke = body.indexOf("effect = 'grant' and revoked_at is null");
  const insert = body.indexOf("insert into public.company_member_access_rules");
  assert.ok(revoke > 0 && insert > revoke);
  assert.match(body, /set revoked_at = now\(\)/);
});

test("handoff still moves only open work and does not rewrite attribution columns", () => {
  const start = sql.indexOf("create or replace function public.handoff_member_open_work_v1(");
  const body = sql.slice(start, sql.indexOf("function public.reactivate_company_member_v1("));
  assert.match(body, /job_is_open_work_v1/);
  assert.match(body, /t\.status = 'open'/);
  assert.match(body, /set assigned_to = p_reassign_to_user_id/);
  assert.doesNotMatch(body, /created_by|sent_by|approved_by/);
  assert.match(body, /stale_revision/);
  assert.match(body, /idempotency_conflict/);
});

test("app copy keeps removal and reassignment distinct, and public pages stay out of custody", () => {
  assert.match(persistence, /Work reassignment still needs attention/);
  assert.match(editor, /Access removed\. \$\{handoffError\}/);
  assert.match(editor, /Work reassignment still needs attention/);
  assert.match(start, /Your access has been removed/);
  assert.match(persistence, /reactivate_company_member_v1/);
  assert.match(persistence, /transfer_company_ownership_v1/);
  assert.doesNotMatch(publicPage, /transfer_company_ownership|reactivate_company_member|recover_company_custody/);
  assert.doesNotMatch(sql, /alter table public\.proposals|alter table public\.job_payment|stripe/i);
});
