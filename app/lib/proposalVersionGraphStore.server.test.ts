/**
 * R18C4B — proposalVersionGraphStore.server tests.
 *
 * Run: npx tsx --test app/lib/proposalVersionGraphStore.server.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";

describe("proposalVersionGraphStore.server source guardrails", () => {
  test("uses server-only admin graph path, not browser getSupabaseClient", () => {
    const source = readFileSync(
      new URL("./proposalVersionGraphStore.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /import "server-only"/);
    assert.match(source, /createAdminClient/);
    assert.match(source, /getProposalVersionGraph/);
    assert.match(source, /requireSentVersion/);
    assert.doesNotMatch(source, /from "@\/app\/lib\/supabaseClient"/);
    assert.doesNotMatch(source, /getDraftGraph\(/);
  });

  test("orchestrator server entry wires public version graph loader", () => {
    const source = readFileSync(
      new URL("./proposalPublicAccessOrchestrator.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /getPublicProposalVersionGraph/);
    assert.match(source, /proposalVersionGraphStore\.server/);
    assert.doesNotMatch(source, /from "@\/app\/lib\/supabaseClient"/);
    assert.doesNotMatch(source, /from "@\/app\/lib\/proposalRecordStore"/);
  });

  test("public route components do not import admin client or server graph loader", () => {
    const files = [
      "../p/layout.tsx",
      "../p/[token]/page.tsx",
      "../p/[token]/PublicProposalPage.tsx",
      "../p/[token]/PublicProposalErrorPage.tsx",
      "../p/[token]/PublicProposalHeader.tsx",
      "../p/[token]/PublicProposalCompanyMark.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.doesNotMatch(source, /createAdminClient/);
      assert.doesNotMatch(source, /proposalVersionGraphStore\.server/);
      assert.doesNotMatch(source, /from "@\/app\/lib\/supabaseClient"/);
    }
  });
});

describe("getPublicProposalVersionGraph contract", () => {
  test("exported loader requires requireSentVersion in options type", () => {
    const source = readFileSync(
      new URL("./proposalVersionGraphStore.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /requireSentVersion:\s*true/);
    assert.match(source, /PublicProposalVersionGraphOptions/);
  });

  test("graph loader passes admin client into proposalRecordStore deps", () => {
    const source = readFileSync(
      new URL("./proposalVersionGraphStore.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /getSupabase:\s*\(\)\s*=>\s*createAdminClient\(\)/);
  });
});

describe("orchestrator server default graph integration shape", () => {
  test("server graph loader signature matches orchestrator getVersionGraph dep", () => {
    const loaderSource = readFileSync(
      new URL("./proposalVersionGraphStore.server.ts", import.meta.url),
      "utf8"
    );
    const orchestratorSource = readFileSync(
      new URL("./proposalPublicAccessOrchestrator.ts", import.meta.url),
      "utf8"
    );

    assert.match(loaderSource, /companyId: string/);
    assert.match(loaderSource, /proposalId: string/);
    assert.match(loaderSource, /versionId: string/);
    assert.match(orchestratorSource, /requireSentVersion: true/);
    assert.match(orchestratorSource, /resolveResult\.company_id/);
    assert.match(orchestratorSource, /resolveResult\.proposal_id/);
    assert.match(orchestratorSource, /resolveResult\.proposal_version_id/);
  });

  test("resolved IDs and requireSentVersion are the only graph load inputs", () => {
    const orchestratorSource = readFileSync(
      new URL("./proposalPublicAccessOrchestrator.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(orchestratorSource, /searchParams/);
    assert.doesNotMatch(orchestratorSource, /getDraftGraph\(/);
    assert.match(
      orchestratorSource,
      /getVersionGraph\(\s*resolveResult\.company_id,\s*resolveResult\.proposal_id,\s*resolveResult\.proposal_version_id,\s*\{\s*requireSentVersion:\s*true\s*\}/
    );
    assert.equal(COMPANY_ID.length, 36);
    assert.equal(PROPOSAL_ID.length, 36);
    assert.equal(VERSION_ID.length, 36);
  });
});
