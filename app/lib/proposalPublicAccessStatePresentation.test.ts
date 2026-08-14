/**
 * V2D4 — Public access-state customer presentation tests.
 * Run: npx tsx --test app/lib/proposalPublicAccessStatePresentation.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  assertPublicProposalDocumentViewModelSafe,
  buildProposalPublicProposalErrorViewModel,
  type ProposalPublicProposalErrorCode,
} from "./proposalPublicProposalViewModel";

const ALL_CODES: ProposalPublicProposalErrorCode[] = [
  "invalid_token",
  "expired_token",
  "revoked_token",
  "superseded_token",
  "proposal_unavailable",
  "graph_unavailable",
  "internal_error",
];

describe("V2D4 public access-state presentation", () => {
  test("internal error codes remain differentiated on the view model", () => {
    const codes = ALL_CODES.map((code) => buildProposalPublicProposalErrorViewModel(code).code);
    assert.deepEqual(codes, ALL_CODES);
  });

  test("customer copy groups expired and revoked while keeping codes distinct", () => {
    const expired = buildProposalPublicProposalErrorViewModel("expired_token");
    const revoked = buildProposalPublicProposalErrorViewModel("revoked_token");
    assert.equal(expired.code, "expired_token");
    assert.equal(revoked.code, "revoked_token");
    assert.equal(expired.title, revoked.title);
    assert.equal(expired.message, revoked.message);
    assert.equal(expired.title, "Proposal link no longer available");
    assert.match(expired.message, /no longer active/i);
  });

  test("superseded remains visibly distinct from expired/revoked/invalid", () => {
    const superseded = buildProposalPublicProposalErrorViewModel("superseded_token");
    const expired = buildProposalPublicProposalErrorViewModel("expired_token");
    const invalid = buildProposalPublicProposalErrorViewModel("invalid_token");
    assert.equal(superseded.title, "A newer proposal is available");
    assert.match(superseded.message, /replaced by a newer version/i);
    assert.notEqual(superseded.title, expired.title);
    assert.notEqual(superseded.title, invalid.title);
    assert.notEqual(superseded.message, expired.message);
  });

  test("invalid and unavailable groups use calm customer language", () => {
    const invalid = buildProposalPublicProposalErrorViewModel("invalid_token");
    assert.equal(invalid.title, "Proposal link not available");
    assert.match(invalid.message, /isn't available/i);
    assert.doesNotMatch(invalid.message, /typed incorrectly|hash|token|version|database/i);

    for (const code of [
      "proposal_unavailable",
      "graph_unavailable",
      "internal_error",
    ] as const) {
      const vm = buildProposalPublicProposalErrorViewModel(code);
      assert.equal(vm.title, "Proposal temporarily unavailable");
      assert.match(vm.message, /couldn't open this proposal/i);
      assert.doesNotMatch(vm.message, /RPC|graph|version_id|token_hash/i);
    }
  });

  test("error VMs stay customer-safe and invent no contractor identity", () => {
    for (const code of ALL_CODES) {
      const vm = buildProposalPublicProposalErrorViewModel(code);
      assert.equal(vm.header, null);
      assertPublicProposalDocumentViewModelSafe(vm);
      const serialized = JSON.stringify(vm);
      assert.doesNotMatch(serialized, /Anderson Roofing|mailto:|tel:/i);
      assert.doesNotMatch(serialized, /"company_id"|"proposal_id"|"proposal_version_id"/);
    }
  });

  test("error page removes redundant footer and invents no contact CTA", () => {
    const page = readFileSync(
      join(process.cwd(), "app/p/[token]/PublicProposalErrorPage.tsx"),
      "utf8"
    );
    assert.match(page, /Roofing proposal/);
    assert.match(page, /data-public-access-state=\{error\.code\}/);
    assert.doesNotMatch(page, /Contact your contractor if you need a new proposal link/);
    assert.doesNotMatch(page, /mailto:|tel:|href=|Anderson|FieldDive/);
    assert.doesNotMatch(page, /Accept|Approve|Builder|Preview|Send|admin/i);
  });

  test("orchestrator mapping and sent-version guardrails remain untouched", () => {
    const orchestrator = readFileSync(
      join(process.cwd(), "app/lib/proposalPublicAccessOrchestrator.ts"),
      "utf8"
    );
    assert.match(orchestrator, /requireSentVersion: true/);
    assert.match(orchestrator, /case "expired":\s*return "expired_token"/);
    assert.match(orchestrator, /case "revoked":\s*return "revoked_token"/);
    assert.match(orchestrator, /case "superseded":\s*return "superseded_token"/);
    assert.doesNotMatch(orchestrator, /getDraftGraph/);
  });
});
