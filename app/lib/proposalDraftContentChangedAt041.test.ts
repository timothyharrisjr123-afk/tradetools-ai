/**
 * 041 migration contract: dirty-clock ownership, client write protection,
 * freeze unchanged, 040/039 discipline.
 *
 * Run: npx tsx --test app/lib/proposalDraftContentChangedAt041.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const SQL_041 = join(
  ROOT,
  "supabase/migrations/20260816_041_proposal_draft_content_changed_at.sql"
);
const SQL_040 = join(
  ROOT,
  "supabase/migrations/20260816_040_proposal_formal_acceptance.sql"
);
const SQL_039 = join(
  ROOT,
  "supabase/migrations/20260816_039_proposal_formal_acceptance.sql"
);
const SQL_038 = join(
  ROOT,
  "supabase/migrations/20260816_038_job_lifecycle_foundation.sql"
);

const sql041 = readFileSync(SQL_041, "utf8");
const sql040 = readFileSync(SQL_040, "utf8");
const sql038 = readFileSync(SQL_038, "utf8");

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("041 migration discipline", () => {
  test("filename and 039 absent / 040 unedited in this pass", () => {
    assert.equal(existsSync(SQL_041), true);
    assert.equal(existsSync(SQL_039), false);
    assert.match(sql041, /040 remains live historical truth and is not edited/);
    assert.match(sql041, /039 remains absent\/reserved/);
    assert.doesNotMatch(sql040, /draft_content_changed_at/);
    assert.doesNotMatch(sql038, /draft_content_changed_at/);
  });

  test("040 hash is stable historical truth", () => {
    const hash = sha256(sql040);
    assert.equal(hash.length, 64);
    assert.match(sql040, /v_dirty := v_proposal\.updated_at > v_version\.frozen_at;/);
  });
});

describe("041 column and dirty semantics", () => {
  test("adds draft_content_changed_at timestamptz not null after backfill", () => {
    assert.match(
      sql041,
      /add column if not exists draft_content_changed_at timestamptz/
    );
    assert.match(
      sql041,
      /alter column draft_content_changed_at set not null/
    );
    assert.match(sql041, /alter column draft_content_changed_at set default now\(\)/);
  });

  test("classifier dirty source switches to draft_content_changed_at", () => {
    assert.match(
      sql041,
      /v_dirty := v_proposal\.draft_content_changed_at > v_version\.frozen_at;/
    );
    assert.doesNotMatch(
      sql041,
      /v_dirty := v_proposal\.updated_at > v_version\.frozen_at;/
    );
  });

  test("create RPC initializes clock to now()", () => {
    const createFn = sql041.slice(
      sql041.indexOf("create or replace function public.persist_draft_proposal_create_v1")
    );
    assert.match(createFn, /draft_content_changed_at/);
    assert.match(createFn, /v_created_by,\s*now\(\)/);
  });

  test("pricing RPC is replaced without pricing-math drift or client column write", () => {
    const pricingFn = sql041.slice(
      sql041.indexOf("create or replace function public.persist_draft_pricing_refresh_v1")
    );
    const freezeIdx = sql041.indexOf("persist_proposal_send_freeze_v1(p_payload jsonb)");
    assert.equal(freezeIdx, -1);
    assert.match(pricingFn, /customer_total_cents/);
    assert.doesNotMatch(
      pricingFn.slice(0, pricingFn.indexOf("comment on function public.persist_draft_pricing_refresh_v1")),
      /draft_content_changed_at\s*=/
    );
  });
});

describe("041 client write protection", () => {
  test("no generic authenticated touch RPC", () => {
    assert.match(
      sql041,
      /revoke all on function public\.proposal_touch_draft_content_changed_at_internal_v1\(uuid, uuid\)\s+from authenticated/
    );
    assert.match(
      sql041,
      /revoke all on function public\.proposal_touch_draft_content_changed_at_internal_v1\(uuid, uuid\)\s+from service_role/
    );
    assert.doesNotMatch(
      sql041,
      /grant execute on function public\.proposal_touch_draft_content_changed_at_internal_v1/
    );
  });

  test("authenticated cannot UPDATE draft_content_changed_at", () => {
    assert.match(
      sql041,
      /revoke update \(draft_content_changed_at\) on table public\.proposals from authenticated/
    );
    assert.match(
      sql041,
      /revoke update \(draft_content_changed_at\) on table public\.proposals from anon/
    );
  });

  test("header guard reverts client timestamp-only writes unless GUC is set", () => {
    const guard = sql041.slice(
      sql041.indexOf("create or replace function public.proposals_guard_draft_content_changed_at_v1")
    );
    assert.match(
      guard,
      /proposal\.allow_draft_content_changed_at_touch/
    );
    assert.match(
      guard,
      /new\.draft_content_changed_at := old\.draft_content_changed_at/
    );
    assert.match(
      guard,
      /new\.selected_option_id is distinct from old\.selected_option_id/
    );
    assert.match(
      guard,
      /new\.measurement_record_id is distinct from old\.measurement_record_id/
    );
  });

  test("child triggers require current mutable draft, skipping freeze copies", () => {
    assert.match(sql041, /proposal_version_is_current_mutable_draft_v1/);
    assert.match(sql041, /pv\.version_kind = 'draft'/);
    assert.match(sql041, /proposal_pages_touch_draft_content/);
    assert.match(sql041, /proposal_scope_decisions_touch_draft_content/);
    assert.match(sql041, /proposal_upgrade_choices_touch_draft_content/);
    assert.match(sql041, /after update of context_echo, policy_echo on public\.proposal_versions/);
  });

  test("app stores no longer stamp the dirty clock", () => {
    const stores = [
      "app/lib/proposalRecordStore.ts",
      "app/lib/proposalScopeDecisionStore.ts",
      "app/lib/proposalUpgradeChoiceStore.ts",
      "app/lib/proposalDraftPricingRefreshPersistence.ts",
    ];
    for (const rel of stores) {
      const source = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(source, /\.update\(\{[\s\S]{0,200}draft_content_changed_at/);
      assert.doesNotMatch(source, /touchMutableDraftProposalUpdatedAt/);
    }
    assert.equal(existsSync(join(ROOT, "app/lib/proposalMutableDraftTouch.ts")), false);
  });
});

describe("041 backfill algorithm in SQL", () => {
  test("clean clamp uses frozen_at, not snapshot_frozen.created_at", () => {
    const stampFn = sql041.slice(
      sql041.indexOf("create or replace function public.proposal_draft_content_changed_at_backfill_stamp_v1")
    );
    const cleanBlock = stampFn.slice(
      stampFn.indexOf("if v_outcome = 'clean' then"),
      stampFn.indexOf("-- dirty or unknown")
    );
    assert.match(cleanBlock, /return v_frozen_at;/);
    assert.match(cleanBlock, /Must use frozen_at, never snapshot_frozen\.created_at/);
  });

  test("unknown and dirty fail to now\(\) without using proposals.updated_at", () => {
    const outcomeFn = sql041.slice(
      sql041.indexOf("create or replace function public.proposal_draft_vs_sent_graph_outcome_v1")
    );
    const body = outcomeFn.slice(
      0,
      outcomeFn.indexOf("create or replace function public.proposal_draft_content_changed_at_backfill_stamp_v1")
    );
    assert.doesNotMatch(body, /v_proposal\.updated_at/);
    assert.doesNotMatch(body, /p\.updated_at/);
    assert.match(body, /return 'unknown'/);
    assert.match(body, /event_type = 'draft_saved'/);
    assert.match(body, /proposal_option_scope_decisions/);
    assert.match(body, /proposal_draft_content_identity_echo_slice_v1/);
  });

  test("matching uses source_template identities, not raw sent-vs-draft UUIDs", () => {
    assert.match(sql041, /proposal_draft_content_backfill_package_key_v1/);
    assert.match(sql041, /src:' \|\| p_source_template_option_id::text/);
    assert.doesNotMatch(sql041, /full join/i);
    assert.match(sql041, /except/);
    assert.match(sql041, /catalog_seed_key/);
    assert.match(sql041, /composition_slot_key/);
  });
});
