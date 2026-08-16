/**
 * V2F complete negatives — no lifecycle foundation, no 038, no persisted diff.
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
  test("no migration 038 exists", () => {
    const migrations = readdirSync(join(ROOT, "supabase/migrations"));
    assert.equal(
      migrations.some((name) => /038/.test(name)),
      false
    );
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
