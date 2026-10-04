/**
 * Core safety — Job direct-write boundary and legacy /api/approval/status retirement.
 *
 * Writer matrix: every jobs mutation runs through SECURITY DEFINER RPCs/triggers except
 * persist_draft_proposal_create_v1 (active_proposal_id) and select_job_measurement_v1
 * (selected_measurement_id, updated_at), which are SECURITY INVOKER and keep only those
 * column grants. Live staging proof: authenticated direct UPDATE/DELETE attempts fail.
 * Run: npx tsx --test app/lib/coreSafetyJobWriteBoundary.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { GET as approvalStatusGet } from "../api/approval/status/route";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const NAME = "20261002120000_core_disposition_authority_and_job_write_boundary.sql";
const SQL = read(`supabase/migrations/${NAME}`);
const MIGRATIONS = readdirSync(join(ROOT, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Job direct-write boundary", () => {
  test("table-level revoke removes every direct UPDATE/DELETE/TRUNCATE path for anon and authenticated", () => {
    assert.match(
      SQL,
      /revoke update, delete, truncate, trigger, references, maintain\n  on table public\.jobs from public, anon, authenticated;/
    );
  });

  test("only the INVOKER canonical-path columns are granted back, to authenticated only", () => {
    const grants = [...SQL.matchAll(/grant update \(([^)]*)\)\s+on table public\.jobs to ([a-z_, ]+);/g)];
    assert.equal(grants.length, 1);
    assert.deepEqual(grants[0]![1]!.split(",").map((c) => c.trim()).sort(), [
      "active_proposal_id",
      "selected_measurement_id",
      "updated_at",
    ]);
    assert.equal(grants[0]![2]!.trim(), "authenticated");
    assert.doesNotMatch(SQL.replace(/^\s*--.*$/gm, ""), /grant[^;]*(delete|truncate|insert)[^;]*on table public\.jobs/i);
  });

  test("sensitive columns are not granted back", () => {
    const grant = SQL.slice(SQL.indexOf("grant update ("));
    for (const column of [
      "archived",
      "deleted_at",
      "customer_id",
      "latest_proposal_id",
      "latest_estimate_id",
      "company_id",
      "assigned_to",
      "crew_label",
      "status",
      "stage",
      "address_line1",
      "created_by",
      "created_at",
      "last_activity_at",
    ]) {
      assert.doesNotMatch(grant, new RegExp(`\\b${column}\\b`), column);
    }
  });

  test("no later migration re-grants direct jobs writes", () => {
    for (const later of MIGRATIONS.slice(MIGRATIONS.indexOf(NAME) + 1)) {
      assert.doesNotMatch(read(`supabase/migrations/${later}`), /grant[^;]*on (table )?public\.jobs/i, later);
    }
  });

  test("the granted columns are exactly what the INVOKER writers set", () => {
    const baseline = read("supabase/migrations/20260909130000_canonical_pre_recovery_baseline.sql");
    const persist = baseline.slice(baseline.indexOf('CREATE OR REPLACE FUNCTION "public"."persist_draft_proposal_create_v1"'));
    assert.match(persist.slice(0, persist.indexOf("$$;")), /update public\.jobs\n    set active_proposal_id = v_proposal_id\n/);
    const measurement = read("supabase/migrations/20260910174500_guard_measurement_is_selected_writes.sql");
    assert.match(measurement, /SECURITY INVOKER/);
    assert.match(measurement, /UPDATE public\.jobs j\n  SET selected_measurement_id = p_measurement_id,\n      updated_at = CASE/);
  });

  test("application code never updates, upserts, or deletes jobs directly except the two canonical paths", () => {
    const allowed = new Set(["app/lib/jobStore.ts", "app/lib/proposalDraftCreatePersistence.ts"]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const src = strip(read(rel));
          if (/from\(\s*["'`]jobs["'`]\s*\)\s*\.(update|upsert|delete)\(/.test(src) && !allowed.has(rel)) {
            offenders.push(rel);
          }
        }
      }
    };
    walk("app");
    assert.deepEqual(offenders, []);
    const draft = strip(read("app/lib/proposalDraftCreatePersistence.ts"));
    assert.match(draft, /\.from\("jobs"\)\s*\.update\(\{ active_proposal_id: proposalId \}\)/);
  });
});

describe("/api/approval/status is retired", () => {
  test("GET returns 410 with no record or PII", async () => {
    const response = await approvalStatusGet();
    assert.equal(response.status, 410);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.ok, false);
    for (const key of ["record", "customerName", "customerEmail", "job", "token", "totalFormatted"]) {
      assert.equal(key in body, false, key);
    }
  });

  test("the route never reads the KV approval store or the token", () => {
    const source = read("app/api/approval/status/route.ts");
    assert.doesNotMatch(source, /getApprovalRecord|@\/app\/lib\/kv|@vercel\/kv|searchParams|customerEmail|customerName/);
  });
});
