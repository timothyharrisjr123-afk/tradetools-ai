/**
 * Run: npx tsx --test app/lib/proposalOptionDescriptionRpcContract.test.ts
 *
 * Source contract: Authorship V1 migrations persist proposal_options.description
 * on draft create and send-freeze RPCs without touching refresh pricing UPDATEs.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS, name), "utf8");
}

describe("proposal_options.description migration/RPC contract", () => {
  test("029 adds nullable description column only", () => {
    const sql = readMigration("20260722_029_add_proposal_option_description.sql");
    assert.match(sql, /alter table public\.proposal_options/i);
    assert.match(sql, /add column if not exists description text/i);
    assert.doesNotMatch(sql, /drop column/i);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create or replace function/i);
    assert.doesNotMatch(sql, /grant |revoke /i);
  });

  test("030 create + freeze INSERT description; refresh not replaced", () => {
    const sql = readMigration("20260722_030_align_proposal_option_description_rpcs.sql");
    assert.match(sql, /create or replace function public\.persist_draft_proposal_create_v1/i);
    assert.match(sql, /create or replace function public\.persist_proposal_send_freeze_v1/i);
    assert.equal(
      (sql.match(/create or replace function public\.persist_draft_pricing_refresh_v1/gi) ?? [])
        .length,
      0
    );
    const descriptionInserts = sql.match(/nullif\(opt->>'description', ''\)/g) ?? [];
    assert.equal(descriptionInserts.length, 2);
    assert.match(sql, /grant execute on function public\.persist_draft_proposal_create_v1/i);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.persist_proposal_send_freeze_v1/i);
    assert.match(sql, /TO service_role/i);
    assert.match(sql, /FROM anon/i);
  });

  test("TS persist payloads include description for create and freeze", () => {
    const create = readFileSync(
      join(process.cwd(), "app/lib/proposalDraftCreatePersistence.ts"),
      "utf8"
    );
    const freeze = readFileSync(
      join(process.cwd(), "app/lib/proposalSendFreezePersistence.ts"),
      "utf8"
    );
    assert.ok(create.includes("description: optionPayload.description ?? null"));
    assert.ok(create.includes("description: option.description,"));
    assert.ok(freeze.includes("description: option.description ?? null"));
  });
});
