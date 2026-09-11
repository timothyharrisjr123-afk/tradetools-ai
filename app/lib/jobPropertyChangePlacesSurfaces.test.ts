/**
 * FD-P2-PLACES-SURFACES — Job Card property change contracts.
 *
 * Local file proves migration + app facade + UI wiring.
 * Live tenancy / shared-property / proposal-freeze proofs run on staging.
 *
 * Run: npx tsx --test app/lib/jobPropertyChangePlacesSurfaces.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CHANGE_JOB_PROPERTY_RPC_V1,
  changeJobPropertyViaRpc,
  type ChangeJobPropertyResult,
} from "./jobPropertyChange";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const MIGRATION = read(
  "supabase/migrations/20260911160551_change_job_property_atomic.sql"
);
const MIGRATION_DEFINER = read(
  "supabase/migrations/20260911172000_change_job_property_security_definer.sql"
);
const MIGRATION_SELECTED_FIX = read(
  "supabase/migrations/20260911173500_change_job_property_selected_path_fix.sql"
);
const FACADE = read("app/lib/jobPropertyChange.ts");
const JOB_STORE = read("app/lib/jobStore.ts");
const PLACES = read("app/lib/placesClient.ts");
const HEADER = read("app/tools/roofing/jobCard/JobCardHeader.tsx");
const PANEL = read("app/tools/roofing/jobCard/JobCardChangePropertyPanel.tsx");
const CLIENT = read("app/tools/roofing/jobCard/JobCardClient.tsx");
const PROPERTY_STORE = read("app/lib/propertyStore.ts");

describe("FD-P2 dedicated atomic property-change RPC", () => {
  test("migration defines change_job_property_v1 with membership + same-company lock", () => {
    assert.match(MIGRATION, /create or replace function public\.change_job_property_v1\(p_payload jsonb\)/i);
    assert.match(MIGRATION, /company_memberships/);
    assert.match(MIGRATION, /j\.company_id = v_company_id/);
    assert.match(MIGRATION, /p\.company_id = v_company_id/);
    assert.match(MIGRATION, /for update/i);
    assert.match(MIGRATION, /resolve_company_property_v1/);
    assert.match(MIGRATION, /grant execute[\s\S]*authenticated/i);
    assert.match(MIGRATION, /revoke all[\s\S]*anon/i);
  });

  test("follow-up migration makes RPC SECURITY DEFINER without granting property_id UPDATE", () => {
    assert.match(MIGRATION_DEFINER, /security definer/i);
    assert.match(MIGRATION_DEFINER, /set search_path = pg_catalog, public/i);
    assert.match(MIGRATION_DEFINER, /company_memberships/);
    assert.match(MIGRATION_DEFINER, /p\.company_id = v_company_id/);
    assert.doesNotMatch(
      MIGRATION_DEFINER,
      /grant update\s*\(\s*property_id\s*\)/i
    );
    assert.match(
      MIGRATION_DEFINER,
      /Does not grant authenticated UPDATE\(property_id\)/i
    );
  });

  test("selected-property path fix avoids unread v_resolved access", () => {
    assert.match(MIGRATION_SELECTED_FIX, /v_resolution text/);
    assert.match(MIGRATION_SELECTED_FIX, /v_resolution := 'selected'/);
    assert.match(
      MIGRATION_SELECTED_FIX,
      /v_resolution := coalesce\(v_resolved\.resolution, 'resolved'\)/
    );
    assert.match(
      MIGRATION_SELECTED_FIX,
      /'resolution', coalesce\(v_resolution, 'resolved'\)/
    );
    assert.doesNotMatch(
      MIGRATION_SELECTED_FIX,
      /when v_existing_property_id is not null then 'selected'[\s\S]*v_resolved\.resolution/
    );
  });

  test("RPC attaches property_id and refreshes operational snapshot only", () => {
    assert.match(MIGRATION_DEFINER, /property_id = v_property\.id/);
    assert.match(MIGRATION_DEFINER, /address_line1 = v_property\.address_line1/);
    assert.match(MIGRATION_DEFINER, /address_line2 = v_property\.address_line2/);
    assert.match(MIGRATION_DEFINER, /address_formatted =/);
    assert.doesNotMatch(
      MIGRATION_DEFINER,
      /update\s+public\.(proposal_versions|proposal_deliveries|customers)\b/i
    );
    assert.doesNotMatch(MIGRATION_DEFINER, /context_echo\s*=/i);
  });

  test("shared property is never mutated for one job address change", () => {
    assert.match(
      MIGRATION_DEFINER,
      /Does not mutate the shared properties row for one job/i
    );
    assert.doesNotMatch(
      MIGRATION_DEFINER,
      /update\s+public\.properties[\s\S]*address_line1/i
    );
  });

  test("cross-company property select fails closed", () => {
    assert.match(MIGRATION_DEFINER, /property_not_found/);
    assert.match(
      MIGRATION_DEFINER,
      /where p\.id = v_existing_property_id[\s\S]*p\.company_id = v_company_id/
    );
  });
});

describe("FD-P2 app facade — updateJob is not property authority", () => {
  test("JobUpdatePatch excludes property_id and address", () => {
    assert.match(JOB_STORE, /property_id\?: never/);
    assert.match(JOB_STORE, /address\?: never/);
    assert.match(JOB_STORE, /delete \(row as \{ property_id\?: string \}\)\.property_id/);
    assert.match(JOB_STORE, /delete \(row as \{ address_line1\?: string \}\)\.address_line1/);
  });

  test("dedicated facade calls change_job_property_v1 only", () => {
    assert.equal(CHANGE_JOB_PROPERTY_RPC_V1, "change_job_property_v1");
    assert.match(FACADE, /supabase\.rpc\(CHANGE_JOB_PROPERTY_RPC_V1/);
    assert.doesNotMatch(FACADE, /updateJob\(/);
  });

  test("createPropertyExplicit is retired (no production callers)", () => {
    assert.match(PROPERTY_STORE, /createPropertyExplicit is retired/);
    assert.doesNotMatch(CLIENT, /createPropertyExplicit\(/);
    assert.doesNotMatch(
      read("app/tools/roofing/RoofingClient.tsx"),
      /createPropertyExplicit\(/
    );
  });
});

describe("FD-P2 Places line2 / subpremise", () => {
  test("Google subpremise maps to address line2", () => {
    assert.match(PLACES, /component\(comps, "subpremise"\)/);
    assert.match(PLACES, /line2\?: string/);
    assert.match(PLACES, /\.\.\.\(line2 \? \{ line2 \} : \{\}\)/);
  });

  test("New Job and Job Card change surfaces accept line2", () => {
    assert.match(
      read("app/tools/roofing/RoofingClient.tsx"),
      /if \(resolved\.address\.line2\) setJobAddress2/
    );
    assert.match(PANEL, /data-jobcard-change-property-line2/);
    assert.match(PANEL, /Unit \/ Apt \/ Suite/);
  });
});

describe("FD-P2 Job Card quiet change UI", () => {
  test("header exposes quiet Change affordance", () => {
    assert.match(HEADER, /data-jobcard-change-property/);
    assert.match(HEADER, />\s*Change\s*</);
    assert.doesNotMatch(HEADER, /Places|Google|feature banner/i);
  });

  test("client wires panel to RPC + hydrate refresh", () => {
    assert.match(CLIENT, /JobCardChangePropertyPanel/);
    assert.match(CLIENT, /changePropertyOpen/);
    assert.match(PANEL, /changeJobPropertyViaRpc/);
    assert.match(PANEL, /refreshHydratedJobRecord|onSaved/);
  });
});

describe("FD-P2 changeJobPropertyViaRpc client validation", () => {
  test("rejects empty payload and invalid address before RPC", async () => {
    const calls: unknown[] = [];
    const supabase = {
      rpc: async (...args: unknown[]) => {
        calls.push(args);
        return { data: null, error: null };
      },
    };

    const missing = await changeJobPropertyViaRpc(supabase, {
      companyId: "",
      jobId: "job",
    });
    assert.deepEqual(missing, { ok: false, code: "invalid_payload" });

    const badAddress = await changeJobPropertyViaRpc(supabase, {
      companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      address: { line1: "   " },
    });
    assert.deepEqual(badAddress, {
      ok: false,
      code: "property_address_invalid",
    });
    assert.equal(calls.length, 0);
  });

  test("maps RPC success and forbidden failure shapes", async () => {
    const okRpc = {
      rpc: async () => ({
        data: {
          ok: true,
          job_id: "j1",
          company_id: "c1",
          property_id: "p2",
          previous_property_id: "p1",
          address_line1: "100 Main St",
          address_line2: "Unit 2",
          address_city: "Tulsa",
          address_state: "OK",
          address_zip: "74103",
          address_country: "US",
          address_formatted: "100 Main St, Tulsa, OK 74103",
          resolution: "created",
        },
        error: null,
      }),
    };
    const ok = (await changeJobPropertyViaRpc(okRpc, {
      companyId: "c1",
      jobId: "j1",
      address: {
        line1: "100 Main St",
        line2: "Unit 2",
        city: "Tulsa",
        state: "OK",
        zip: "74103",
      },
    })) as Extract<ChangeJobPropertyResult, { ok: true }>;
    assert.equal(ok.ok, true);
    assert.equal(ok.propertyId, "p2");
    assert.equal(ok.previousPropertyId, "p1");
    assert.equal(ok.addressLine2, "Unit 2");

    const denyRpc = {
      rpc: async () => ({
        data: { ok: false, code: "forbidden" },
        error: null,
      }),
    };
    const denied = await changeJobPropertyViaRpc(denyRpc, {
      companyId: "c1",
      jobId: "j1",
      propertyId: "foreign-property",
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "forbidden");
  });
});
