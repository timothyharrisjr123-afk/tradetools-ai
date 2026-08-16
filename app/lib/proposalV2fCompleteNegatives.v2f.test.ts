/**
 * V2F complete negatives — no C4 038 hardening, no persisted diff.
 * Run: npx tsx --test app/lib/proposalV2fCompleteNegatives.v2f.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("V2F complete negatives", () => {
  test("migration 038 is job lifecycle foundation, not C4 mint hardening", () => {
    const migrations = readdirSync(join(ROOT, "supabase/migrations"));
    const files038 = migrations.filter((name) => /038/.test(name));
    assert.deepEqual(files038, ["20260816_038_job_lifecycle_foundation.sql"]);
    const sql = read(`supabase/migrations/${files038[0]}`);
    assert.match(sql, /Job Lifecycle Foundation/);
    assert.doesNotMatch(sql, /contractor_email_send/);
    assert.doesNotMatch(sql, /email_send_not_allowed/);
    assert.doesNotMatch(sql, /persist_proposal_public_access_mint/);
  });

  test("change summary is runtime-only", () => {
    const source = read("app/lib/proposalRevisionChangeSummary.ts");
    assert.doesNotMatch(source, /create table|insert into|from\("/i);
    assert.match(source, /comparePackageCompositions/);
    assert.doesNotMatch(source, /jobs\.stage|proposals\.status/);
  });

  test("Preview change summary stays contractor chrome", () => {
    const client = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx"
    );
    assert.match(client, /ProposalPreviewChangeSummary/);
    assert.match(client, /PREVIEW_COMMAND_SURFACE/);
    assert.doesNotMatch(client, /mint_and_supersede|mint_proposal_public_access_token/);
    assert.doesNotMatch(client, /redirect.*latest|replacement_url/i);
  });

  test("Job Card does not become a diff dashboard", () => {
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    assert.doesNotMatch(tab, /Changes since last sent|buildRevisionChangeSummary/);
  });

  test("public superseded copy remains calm and non-redirecting", () => {
    const vm = read("app/lib/proposalPublicProposalViewModel.ts");
    assert.match(vm, /A newer proposal is available/);
    assert.doesNotMatch(vm, /replacement_url|Continue to latest/i);
  });
});

describe("V2F complete source presence", () => {
  test("dedicated wrapper and change-summary files exist", () => {
    assert.equal(existsSync(join(ROOT, "app/lib/proposalRevisionChangeSummary.ts")), true);
    assert.equal(existsSync(join(ROOT, "app/lib/proposalSentVersionLineage.ts")), true);
    const store = read("app/lib/proposalPublicAccessTokenMintStore.server.ts");
    assert.match(store, /export async function mintAndSupersedeProposalPublicAccessToken/);
  });
});
