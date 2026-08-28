/**
 * Tasks V1 — schema, security, authority.
 * Run: npx tsx --test app/lib/jobTaskSql058.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { AFTER_048_MIGRATIONS } from "./jobPaymentBalance054.test";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

const SQL_057 = join(MIGRATIONS, "20260828_057_job_attachments.sql");
const SQL_058 = join(MIGRATIONS, "20260828_058_job_tasks.sql");
const SHA_057 = "EE5520AB0BC05E96C9A72EA30D26F142D75C80D77A1083BAD5A2CD4A7E774C46";

describe("058 — historical files stay locked", () => {
  test("057 unchanged; 058 is job tasks not payment", () => {
    assert.equal(existsSync(SQL_058), true);
    assert.equal(sha(SQL_057), SHA_057);
    assert.ok(!readdirSync(MIGRATIONS).some((name) => name.includes("_039_")));
    const sql = readFileSync(SQL_058, "utf8");
    assert.equal(
      sha(SQL_058),
      "A705AE8416A29F74658A9D3CCE06B65F231E7A2719984465ED538181CB39E4C4"
    );
    assert.match(sql, /039 remains reserved/);
    assert.doesNotMatch(sql, /job_payment_requests/);
    assert.match(sql, /No assigned_to/);
    assert.doesNotMatch(sql, /assigned_to uuid/);
  });

  test("AFTER_048 list includes 058 tasks file", () => {
    const names = readdirSync(MIGRATIONS).filter(
      (n) => n.endsWith(".sql") && /_0(49|5\d)_/.test(n)
    );
    assert.deepEqual(names.sort(), [...AFTER_048_MIGRATIONS].sort());
  });
});

describe("058 — schema", () => {
  const sql = readFileSync(SQL_058, "utf8");

  test("columns, open/complete only, due_on date, no assignment", () => {
    assert.match(sql, /create table if not exists public\.job_tasks/);
    assert.match(sql, /due_on date null/);
    assert.match(sql, /status in \('open', 'complete'\)/);
    assert.match(sql, /char_length\(title\) between 1 and 120/);
    assert.match(sql, /notes is null or char_length\(notes\) <= 500/);
    assert.match(sql, /deleted_at timestamptz null/);
    const tableBody = sql.slice(
      sql.indexOf("create table if not exists public.job_tasks"),
      sql.indexOf("comment on table public.job_tasks")
    );
    assert.doesNotMatch(tableBody, /assigned_to/);
    assert.doesNotMatch(
      tableBody,
      /priority|subtask|label|template_|estimated_hours|reminder|copilot|attachment_id/i
    );
  });

  test("completion and reopen invariants", () => {
    assert.match(
      sql,
      /status = 'open' and completed_at is null and completed_by is null/
    );
    assert.match(sql, /status = 'complete' and completed_at is not null/);
    assert.match(sql, /new\.completed_at := now\(\)/);
    assert.match(sql, /new\.completed_at := null/);
    assert.match(sql, /new\.completed_by := null/);
  });

  test("company/job match and identity immutability", () => {
    assert.match(sql, /company_id must match jobs\.company_id/);
    assert.match(sql, /identity fields are immutable/);
  });

  test("list indexes; not over-indexed", () => {
    assert.match(sql, /idx_job_tasks_job_active/);
    assert.match(sql, /where deleted_at is null/);
    assert.equal((sql.match(/create index/g) ?? []).length, 2);
  });

  test("RLS company membership; no DELETE policy", () => {
    assert.match(sql, /enable row level security/);
    assert.match(sql, /job_tasks_select_company_scope/);
    assert.match(sql, /company_memberships/);
    assert.match(sql, /No DELETE policy/);
    assert.match(
      sql,
      /grant select, insert, update on table public\.job_tasks to authenticated/
    );
    assert.match(sql, /revoke all on table public\.job_tasks from anon/);
    assert.doesNotMatch(sql, /for delete/i);
  });
});

describe("058 — authority isolation", () => {
  const sql = readFileSync(SQL_058, "utf8");
  const persist = read("app/lib/jobTaskPersistence.ts");
  const routes = [
    read("app/api/jobs/[jobId]/tasks/route.ts"),
    read("app/api/jobs/[jobId]/tasks/[taskId]/route.ts"),
  ].join("\n");
  const ui = [
    read("app/tools/roofing/jobCard/JobCardTasksWorkspace.tsx"),
    read("app/tools/roofing/jobCard/useJobCardTasks.ts"),
    read("app/tools/roofing/jobCard/JobCardSecondaryPanels.tsx"),
  ].join("\n");

  test("no Calendar writes", () => {
    assert.doesNotMatch(sql, /job_schedules/);
    assert.doesNotMatch(persist, /job_schedules|create_job_schedule|reschedule/);
    assert.doesNotMatch(routes, /job_schedules/);
  });

  test("no Attention writes", () => {
    assert.doesNotMatch(sql, /job_attention/);
    assert.doesNotMatch(persist, /job_attention|upsertJobAttention/);
    assert.doesNotMatch(ui, /job_attention/);
  });

  test("no Activity events", () => {
    assert.doesNotMatch(sql, /record_job_activity_v1/);
    assert.doesNotMatch(persist, /record_job_activity/);
    assert.doesNotMatch(ui, /Task created|Task completed|record_job_activity/);
  });

  test("no Board or Overview task chrome", () => {
    const overview = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");
    const board = read("app/tools/roofing/saved/jobsBoardUtils.ts");
    const card = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
    assert.doesNotMatch(overview, /job_tasks|open task|overdue task/i);
    assert.doesNotMatch(board, /job_tasks/);
    assert.doesNotMatch(card, /job_tasks/);
    assert.doesNotMatch(ui, /Tasks 0\/0|Tasks 1\/3/);
  });

  test("no proposal, measurement, payment, or lifecycle writes", () => {
    assert.match(sql, /NEVER writes jobs\.stage/);
    assert.doesNotMatch(persist, /proposal_records|measurement_records|job_payment/);
    assert.doesNotMatch(persist, /complete_job_work|start_job_work|change_job_disposition/);
    assert.doesNotMatch(routes, /proposal_records|measurement_records|job_payment/);
    assert.doesNotMatch(persist, /\.update\(\s*\{[^}]*stage/);
  });

  test("open tasks do not block Complete", () => {
    const eligibility = read("app/lib/jobLifecycleActionEligibility.ts");
    const completeSql = read("supabase/migrations/20260823_047_job_work_complete.sql");
    const next = read("app/tools/roofing/jobCard/JobCardNextActionPanel.tsx");
    assert.doesNotMatch(eligibility, /job_tasks|openTask|taskCount/);
    assert.doesNotMatch(completeSql, /job_tasks/);
    assert.doesNotMatch(next, /finish all tasks|complete all tasks/i);
  });
});
