/**
 * V2E2A1 — Composition role/slot identity contract tests.
 *
 * Run: npx tsx --test app/lib/packageCompositionIdentity.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "./defaultRoofingCatalog";
import { ROOF_REPLACEMENT_CORE_LINE_ITEMS } from "./defaultRoofingProposalTemplates";
import {
  generateCompositionInstanceSlotKey,
  normalizeCompositionRole,
  normalizeCompositionSlotKey,
  ORIGINAL_STARTER_CATALOG_COMPOSITION_ROLES,
  resolveStarterCompositionIdentity,
  STARTER_CATALOG_COMPOSITION_ROLES,
} from "./packageCompositionIdentity";

const MIGRATION = path.join(
  process.cwd(),
  "supabase/migrations/20260815_036_add_composition_role_and_slot.sql"
);

describe("starter Catalog composition role map", () => {
  test("exact 13 original starter Catalog roles remain mapped", () => {
    assert.equal(Object.keys(ORIGINAL_STARTER_CATALOG_COMPOSITION_ROLES).length, 13);
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.architectural_shingles"], "roof_covering");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.synthetic_underlayment"], "underlayment");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.starter_strip"], "starter");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.ridge_cap"], "ridge_cap");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.drip_edge"], "drip_edge");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.ice_water_valley"], "ice_water");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.pipe_boot"], "pipe_boot");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.roof_vent"], "ventilation");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.step_flashing"], "step_flashing");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.install_labor"], "install_labor");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.tear_off_labor"], "tear_off");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.disposal"], "disposal");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.permit_admin_fee"], "permit");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.designer_shingles"], "roof_covering");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.premium_synthetic_underlayment"], "underlayment");
    assert.equal(STARTER_CATALOG_COMPOSITION_ROLES["roofing.ice_water_eaves"], "ice_water");
  });

  test("passive Catalog definitions stamp reviewed roles", () => {
    assert.equal(DEFAULT_ROOFING_CATALOG_DEFINITIONS.length, 16);
    for (const def of DEFAULT_ROOFING_CATALOG_DEFINITIONS) {
      assert.equal(
        def.composition_role,
        STARTER_CATALOG_COMPOSITION_ROLES[def.metadata.seed_key]
      );
    }
  });

  test("Template core slots match reviewed map including ice_water.valleys", () => {
    const bySeed = new Map(
      ROOF_REPLACEMENT_CORE_LINE_ITEMS.map((item) => [item.catalog_seed_key, item])
    );
    assert.equal(bySeed.size, 13);
    assert.equal(bySeed.get("roofing.architectural_shingles")?.composition_slot_key, "roof_covering");
    assert.equal(bySeed.get("roofing.ice_water_valley")?.composition_slot_key, "ice_water.valleys");
    assert.equal(bySeed.get("roofing.roof_vent")?.composition_slot_key, "ventilation");
    assert.equal(
      resolveStarterCompositionIdentity("roofing.ice_water_eaves", "included")?.compositionSlotKey,
      "ice_water.eaves"
    );
    assert.equal(
      resolveStarterCompositionIdentity("roofing.roof_vent", "optional")?.compositionSlotKey,
      "ventilation.additional"
    );
    const src = readFileSync(
      path.join(process.cwd(), "app/lib/defaultRoofingProposalTemplates.ts"),
      "utf8"
    );
    assert.match(src, /composition_slot_key: "ventilation.additional"/);
  });
});

describe("slug normalization", () => {
  test("blank values normalize to null", () => {
    assert.equal(normalizeCompositionRole("  "), null);
    assert.equal(normalizeCompositionSlotKey(""), null);
    assert.equal(normalizeCompositionRole("roof_covering"), "roof_covering");
    assert.equal(normalizeCompositionSlotKey("ice_water.valleys"), "ice_water.valleys");
  });
});

describe("future slot generator", () => {
  test("uses crypto.randomUUID without hyphens and does not use Math.random", () => {
    const key = generateCompositionInstanceSlotKey("ventilation");
    assert.match(key, /^ventilation\.[a-f0-9]{32}$/);
    const src = readFileSync(
      path.join(process.cwd(), "app/lib/packageCompositionIdentity.ts"),
      "utf8"
    );
    assert.match(src, /globalThis\.crypto\.randomUUID/);
    assert.doesNotMatch(src, /Math\.random|Date\.now/);
  });
});

describe("migration 036 contract", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  test("adds five nullable columns and slug/slot-requires-role checks", () => {
    assert.match(sql, /alter table public\.catalog_items[\s\S]*composition_role text null/);
    assert.match(sql, /proposal_template_items[\s\S]*composition_slot_key text null/);
    assert.match(sql, /proposal_line_items[\s\S]*composition_slot_key text null/);
    assert.match(sql, /\^\[a-z\]\[a-z0-9_\]\*\$/);
    assert.match(sql, /\^\[a-z\]\[a-z0-9_\]\*\(\\\.\[a-z0-9_\]\+\)\*\$/);
    assert.match(sql, /composition_slot_key is null\s+or composition_role is not null/);
  });

  test("backfills Catalog 13-seed map and Template/draft slot exceptions", () => {
    assert.equal(Object.keys(ORIGINAL_STARTER_CATALOG_COMPOSITION_ROLES).length, 13);
    for (const [seed, role] of Object.entries(ORIGINAL_STARTER_CATALOG_COMPOSITION_ROLES)) {
      assert.match(sql, new RegExp(`'${seed}', '${role}'`));
    }
    assert.match(sql, /ice_water\.valleys/);
    assert.match(sql, /ventilation\.additional/);
  });

  test("draft-only line backfill; frozen kinds untouched; no trigger bypass", () => {
    assert.match(sql, /pv\.version_kind = 'draft'/);
    assert.doesNotMatch(sql, /version_kind in \('sent'/);
    assert.doesNotMatch(sql, /DISABLE TRIGGER/i);
    assert.doesNotMatch(sql, /session_replication_role/);
    assert.doesNotMatch(sql, /update public\.proposal_line_items[\s\S]*version_kind = 'sent'/);
  });

  test("replaces create/refresh/freeze RPCs with composition JSON reads and exact grants", () => {
    assert.match(sql, /create or replace function public\.persist_draft_proposal_create_v1\(p_payload jsonb\)/);
    assert.match(sql, /create or replace function public\.persist_draft_pricing_refresh_v1\(p_payload jsonb\)/);
    assert.match(sql, /create or replace function public\.persist_proposal_send_freeze_v1\(p_payload jsonb\)/);
    assert.equal((sql.match(/nullif\(line->>'composition_role', ''\)/g) ?? []).length, 3);
    assert.equal((sql.match(/nullif\(line->>'composition_slot_key', ''\)/g) ?? []).length, 3);
    assert.match(sql, /grant execute on function public\.persist_draft_proposal_create_v1\(jsonb\) to authenticated;/i);
    assert.match(sql, /grant execute on function public\.persist_draft_pricing_refresh_v1\(jsonb\) to authenticated;/i);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.persist_proposal_send_freeze_v1\(jsonb\) TO service_role;/);
    assert.doesNotMatch(sql, /grant execute on function public\.persist_draft_proposal_create_v1\(jsonb\) to anon/i);
    assert.doesNotMatch(sql, /create index/i);
  });
});
