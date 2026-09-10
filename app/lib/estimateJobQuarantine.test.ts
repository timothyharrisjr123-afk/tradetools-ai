import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { resolveBoardEntryOpenHref } from "./jobBoardAdapter";
import type { RoofingEstimate } from "./estimateStore";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const JOB_STORE = read("app/lib/jobStore.ts");
const ROOFING_CLIENT = read("app/tools/roofing/RoofingClient.tsx");
const ESTIMATE_STORE = read("app/lib/estimateStore.ts");
const BIRTH_GUARD = read(
  "supabase/migrations/20260910200000_quarantine_estimate_job_birth.sql"
);
const IDENTITY_GUARD = read(
  "supabase/migrations/20260910200100_enforce_estimate_job_identity.sql"
);
const REMEDIATION = read(
  "scripts/ops/20260910_production_estimate_job_duplicate_claim_remediation.sql"
);

const ESTIMATE_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";

function legacyEstimate(overrides: Partial<RoofingEstimate> = {}): RoofingEstimate {
  return {
    id: ESTIMATE_ID,
    createdAt: "2026-09-10T00:00:00.000Z",
    customerName: "A3 fixture",
    address: "100 Test St",
    zip: "74120",
    roofAreaSqFt: 20,
    selectedTier: "Core",
    suggestedPrice: 100,
    ...overrides,
  };
}

describe("FD-P1-02 estimate/job dual-birth quarantine", () => {
  test("current resolver has no job-creation fallback and linking is company-scoped", () => {
    const start = JOB_STORE.indexOf("export async function resolveJobForEstimate");
    const end = JOB_STORE.indexOf("export async function getJobsByCompany", start);
    assert.ok(start >= 0 && end > start);
    const resolver = JOB_STORE.slice(start, end);

    assert.doesNotMatch(resolver, /createJob\s*\(/);
    assert.doesNotMatch(JOB_STORE, /function linkEstimateToJob\s*\(/);
    assert.doesNotMatch(JOB_STORE, /function estimateSnapshotToJobDraft\s*\(/);
    assert.doesNotMatch(JOB_STORE, /export async function getOrCreateJobForEstimate/);
    assert.match(resolver, /status: "unlinked"/);
    assert.match(JOB_STORE, /\.eq\("company_id", cid\)/);
    assert.match(JOB_STORE, /existing\?\.company_id === cid/);
    assert.match(ROOFING_CLIENT, /resolveJobForEstimate/);
  });

  test("linked Board estimate opens Job Card; unlinked is retired to Board (no loadSaved workspace)", () => {
    assert.equal(
      resolveBoardEntryOpenHref(legacyEstimate({ jobId: JOB_ID })),
      `/tools/roofing?entry=job-card&job=${JOB_ID}`
    );
    assert.equal(resolveBoardEntryOpenHref(legacyEstimate()), "/tools/roofing/saved");
    assert.doesNotMatch(
      resolveBoardEntryOpenHref(legacyEstimate()),
      /loadSaved=/
    );
    assert.match(ROOFING_CLIENT, /legacyEstimateMode = false/);
    assert.match(ROOFING_CLIENT, /resolveJobForEstimate/);
    assert.doesNotMatch(ROOFING_CLIENT, /getOrCreateJobForEstimate/);
    assert.match(ROOFING_CLIENT, /router\.replace\("\/tools\/roofing\/saved"\)/);
    assert.doesNotMatch(
      ROOFING_CLIENT,
      /replaceState\([\s\S]*loadSaved=\$\{encodeURIComponent\(loadSavedId\)\}/
    );
  });

  test("estimate save remains estimate-only and preserves optional existing job link", () => {
    const start = ESTIMATE_STORE.indexOf("function estimateToRow");
    const end = ESTIMATE_STORE.indexOf("let supabaseFetchStarted", start);
    const mapper = ESTIMATE_STORE.slice(start, end);
    assert.match(mapper, /job_id: e\.jobId \?\? null/);
    assert.doesNotMatch(ESTIMATE_STORE, /\.from\(["']jobs["']\)\s*\.insert/);
  });

  test("DB phase 1 blocks first and concurrent stale estimate births without touching history", () => {
    assert.match(BIRTH_GUARD, /before insert or update of latest_estimate_id, source_metadata on public\.jobs/i);
    assert.match(BIRTH_GUARD, /new\.latest_estimate_id/i);
    assert.match(BIRTH_GUARD, /estimate_snapshot/);
    assert.match(BIRTH_GUARD, /estimate_job_birth_retired/);
    assert.match(BIRTH_GUARD, /latest_estimate_claim_retired/);
    assert.doesNotMatch(BIRTH_GUARD, /delete\s+from|update\s+public\.jobs/i);
  });

  test("DB phase 2 preserves 1:N while enforcing claim uniqueness and same-company links", () => {
    assert.match(IDENTITY_GUARD, /unique index[\s\S]*company_id, btrim\(latest_estimate_id\)/i);
    assert.match(IDENTITY_GUARD, /foreign key \(job_id, company_id\)/i);
    assert.match(IDENTITY_GUARD, /references public\.jobs \(id, company_id\)/i);
    assert.match(IDENTITY_GUARD, /estimate_company_id_immutable/);
    assert.doesNotMatch(IDENTITY_GUARD, /unique\s*\(job_id\)|unique index[^;]*estimates[^;]*job_id/i);
    assert.match(IDENTITY_GUARD, /cross_company_or_orphan_estimate_job_links_require_remediation/);
  });

  test("production remediation is one-row, assertion-heavy, and non-destructive", () => {
    assert.match(REMEDIATION, /TARGET: production project rhquhnujjnzjhweypavd only/);
    assert.match(REMEDIATION, /losing_job_has_downstream_truth/);
    assert.match(REMEDIATION, /set latest_estimate_id = null/i);
    assert.match(REMEDIATION, /v_updated <> 1/);
    assert.doesNotMatch(REMEDIATION, /delete\s+from|update\s+public\.estimates|update\s+public\.proposals/i);
  });
});
