/**
 * R2B — Preferred setup for roofing proposals.
 *
 * Run: npx tsx --test app/tools/roofing/templates/templatesPreferredSetup.test.ts
 *
 * Preferred setup = which reusable setup Job Card suggests first for a workflow.
 * Separate from R1 package-option is_default and R2A archive/restore.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  isTemplateEligibleForPreferredSetup,
  MODULE_KEY_ROOFING,
  PREFERENCE_KIND_PREFERRED_SETUP,
  WORKFLOW_KEY_PROPOSAL,
} from "@/app/lib/companyTemplatePreferenceStore";
import { resolveDefaultJobCardTemplateId } from "../jobCard/jobCardProposalSetup";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");
const STORE_PREF = join(process.cwd(), "app/lib/companyTemplatePreferenceStore.ts");
const STORE_TEMPLATE = join(process.cwd(), "app/lib/proposalTemplateStore.ts");
const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260722_032_create_company_template_preferences.sql"
);
const ROOFING_CLIENT = join(process.cwd(), "app/tools/roofing/RoofingClient.tsx");
const JOB_CARD = join(process.cwd(), "app/tools/roofing/jobCard/jobCardProposalSetup.ts");

function readTemplates(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("R2B migration contract — company_template_preferences", () => {
  test("migration creates preference table with unique slot and company-scoped template FK", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const executable = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.match(sql, /create table if not exists public\.company_template_preferences/i);
    assert.match(sql, /unique \(company_id, module_key, workflow_key, preference_kind\)/i);
    assert.match(
      sql,
      /foreign key \(template_id, company_id\)\s+references public\.proposal_templates \(id, company_id\)/i
    );
    assert.match(sql, /preference_kind in \('preferred_setup'\)/i);
    assert.match(sql, /on delete cascade/i);
    assert.doesNotMatch(executable, /alter table public\.proposal_templates/i);
    assert.doesNotMatch(executable, /proposal_template_options/i);
    assert.doesNotMatch(executable, /proposal_versions/i);
    assert.doesNotMatch(executable, /proposal_options/i);
    assert.doesNotMatch(executable, /proposal_line_items/i);
    assert.doesNotMatch(executable, /removed_at/i);
  });

  test("migration enables RLS with select/insert/update/delete for company members", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /company_template_preferences_select_company_scope/);
    assert.match(sql, /company_template_preferences_insert_company_scope/);
    assert.match(sql, /company_template_preferences_update_company_scope/);
    assert.match(sql, /company_template_preferences_delete_company_scope/);
    assert.match(sql, /company_memberships/);
  });
});

describe("R2B store contract — preferred setup helpers", () => {
  test("exports roofing proposal preferred constants", () => {
    assert.equal(MODULE_KEY_ROOFING, "roofing");
    assert.equal(WORKFLOW_KEY_PROPOSAL, "proposal");
    assert.equal(PREFERENCE_KIND_PREFERRED_SETUP, "preferred_setup");
  });

  test("isTemplateEligibleForPreferredSetup rejects archived and inactive", () => {
    assert.equal(isTemplateEligibleForPreferredSetup({ status: "active", active: true }), true);
    assert.equal(isTemplateEligibleForPreferredSetup({ status: "archived", active: false }), false);
    assert.equal(isTemplateEligibleForPreferredSetup({ status: "active", active: false }), false);
  });

  test("store exposes set/get/clear helpers and rejects archived in setPreferredSetup", () => {
    const store = readFileSync(STORE_PREF, "utf8");
    assert.ok(store.includes("export async function getPreferredSetupTemplateId"));
    assert.ok(store.includes("export async function getPreferredSetupPreference"));
    assert.ok(store.includes("export async function setPreferredSetup"));
    assert.ok(store.includes("export async function clearPreferredSetup"));
    assert.ok(store.includes("export async function clearPreferredSetupIfTemplate"));
    assert.ok(store.includes("isTemplateEligibleForPreferredSetup"));
    assert.ok(store.includes('onConflict: "company_id,module_key,workflow_key,preference_kind"'));
    assert.doesNotMatch(store, /proposal_template_options/);
    assert.doesNotMatch(store, /removed_at/);
    assert.doesNotMatch(store, /proposal_versions/);
  });

  test("archiveProposalTemplate clears preferred preference when matching", () => {
    const store = readFileSync(STORE_TEMPLATE, "utf8");
    const archiveFn = store.slice(
      store.indexOf("export async function archiveProposalTemplate"),
      store.indexOf("export async function restoreProposalTemplate")
    );
    assert.ok(archiveFn.includes("clearPreferredSetupIfTemplate"));
    assert.ok(archiveFn.includes('status: "archived", active: false'));
    assert.doesNotMatch(archiveFn, /removed_at/);
    assert.doesNotMatch(archiveFn, /proposal_options/);
  });

  test("restoreProposalTemplate does not auto-restore preferred", () => {
    const store = readFileSync(STORE_TEMPLATE, "utf8");
    const restoreStart = store.indexOf("export async function restoreProposalTemplate");
    const restoreFn = store.slice(restoreStart, restoreStart + 500);
    assert.ok(restoreFn.includes('status: "active", active: true'));
    assert.doesNotMatch(restoreFn, /setPreferredSetup/);
    assert.doesNotMatch(restoreFn, /clearPreferredSetup/);
  });
});

describe("R2B — Job Card preferred-first resolution", () => {
  test("preferred setup beats starter seed_key when eligible", () => {
    const templates = [
      { id: "starter", name: "Roof", active: true, status: "active" },
      { id: "preferred", name: "Custom preferred", active: true, status: "active" },
    ] as never;
    assert.equal(
      resolveDefaultJobCardTemplateId(templates, "starter", "preferred"),
      "preferred"
    );
  });

  test("falls back to starter when no preferred", () => {
    const templates = [
      { id: "a", name: "A", active: true, status: "active" },
      { id: "starter", name: "Roof", active: true, status: "active" },
    ] as never;
    assert.equal(resolveDefaultJobCardTemplateId(templates, "starter", null), "starter");
  });

  test("ignores preferred when archived", () => {
    const templates = [
      { id: "preferred", name: "Old", active: false, status: "archived" },
      { id: "starter", name: "Roof", active: true, status: "active" },
    ] as never;
    assert.equal(
      resolveDefaultJobCardTemplateId(templates, "starter", "preferred"),
      "starter"
    );
  });

  test("ignores preferred when missing from eligible list", () => {
    const templates = [
      { id: "starter", name: "Roof", active: true, status: "active" },
    ] as never;
    assert.equal(
      resolveDefaultJobCardTemplateId(templates, "starter", "gone"),
      "starter"
    );
  });

  test("RoofingClient loads preferred id into resolver", () => {
    const client = readFileSync(ROOFING_CLIENT, "utf8");
    assert.ok(client.includes("getPreferredSetupTemplateId"));
    assert.ok(client.includes("preferredTemplateId"));
    assert.ok(client.includes("resolveDefaultJobCardTemplateId("));
    assert.ok(client.includes("preferredTemplateId"));
    // Third arg to resolver is the loaded preferred setup id (R2B).
    assert.match(
      client,
      /resolveDefaultJobCardTemplateId\([\s\S]*?preferredTemplateId[\s\S]*?\)/
    );
  });

  test("resolver source documents preferred before starter", () => {
    const source = readFileSync(JOB_CARD, "utf8");
    assert.match(source, /preferredTemplateId/);
    assert.match(source, /R2B/);
  });
});

describe("R2B — Templates UI preferred setup", () => {
  test("library and header use Preferred / Make preferred copy", () => {
    const flow = readTemplates("templatesWorkspaceFlow.ts");
    const row = readTemplates("TemplatesTemplateLibraryRow.tsx");
    const review = readTemplates("TemplatesQuoteSetupReview.tsx");
    assert.ok(flow.includes("TEMPLATES_PREFERRED_BADGE_LABEL"));
    assert.ok(flow.includes("TEMPLATES_MAKE_PREFERRED_ACTION_LABEL"));
    assert.ok(flow.includes("TEMPLATES_PREFERRED_HELPER_COPY"));
    assert.match(flow, /Preferred for new roofing proposals/);
    assert.match(flow, /Used first when starting a proposal from a Job Card/);
    assert.ok(row.includes("onMakePreferred"));
    assert.ok(row.includes("TEMPLATES_PREFERRED_BADGE_LABEL"));
    assert.ok(row.includes("data-templates-library-make-preferred"));
    assert.ok(review.includes("data-templates-make-preferred"));
    assert.ok(review.includes("data-templates-preferred-badge"));
    assert.doesNotMatch(row, /system default|database default|is_default/i);
    assert.doesNotMatch(review, /system default|database default/i);
  });

  test("archived rows do not expose Make preferred", () => {
    const row = readTemplates("TemplatesTemplateLibraryRow.tsx");
    assert.ok(row.includes("!archived && Boolean(onMakePreferred)"));
  });

  test("TemplatesSetupClient wires preference store helpers", () => {
    const setup = readTemplates("TemplatesSetupClient.tsx");
    assert.ok(setup.includes("setPreferredSetup"));
    assert.ok(setup.includes("clearPreferredSetup"));
    assert.ok(setup.includes("getPreferredSetupTemplateId"));
    assert.ok(setup.includes("handleMakePreferred"));
    assert.ok(setup.includes("onMakePreferred={handleMakePreferred}"));
  });
});

describe("R2B — protected systems untouched", () => {
  test("preference files do not import pricing, freeze, or package soft-remove writers", () => {
    const files = [
      readFileSync(STORE_PREF, "utf8"),
      readTemplates("TemplatesLibrarySection.tsx"),
      readTemplates("TemplatesTemplateLibraryRow.tsx"),
      readTemplates("TemplatesQuoteSetupReview.tsx"),
    ];
    for (const source of files) {
      assert.doesNotMatch(source, /proposalPricingEngine/);
      assert.doesNotMatch(source, /proposalSendFreeze/);
      assert.doesNotMatch(source, /softRemoveProposalTemplateOption/);
      assert.doesNotMatch(source, /ProposalBuilderPackageSelector/);
    }
  });
});
