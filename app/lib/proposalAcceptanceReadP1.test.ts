/**
 * Acceptance-read P1 — a failed acceptance read is never "no acceptance".
 * Run: npx tsx --test app/lib/proposalAcceptanceReadP1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  acceptedProposalIdsFromRows,
  applyProposalAcceptanceReadFailure,
  applyProposalAcceptanceReadSuccess,
  beginProposalAcceptanceRead,
  createInitialProposalAcceptanceReadState,
  proposalAcceptanceFactsKnown,
  proposalAcceptanceFactsUnavailable,
} from "./proposalAcceptanceReadState";
import {
  JOB_CARD_SITUATION_PROPOSAL_FACTS_UNAVAILABLE,
  resolveJobCardOverviewSituation,
  type JobCardOverviewSituationInput,
} from "./jobCardOverviewSituation";
import { JOB_CARD_AWAITING_CONTRACTOR_APPROVAL } from "./jobCardForwardLifecycleAction";
import { resolveCanonicalJobActionEligibilityFromFacts } from "./jobLifecycleActionEligibility";
import { approvalPendingFromAttentionType, findApproveJobAcceptanceItem } from "./boardGuardedMovement";
import { applyAttentionDetailFetchResult } from "./surfaceReadFailureSemantics";
import { buildFieldBriefViewModel } from "./fieldBriefModel";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const READER = read("app/lib/proposalAcceptanceActivity.ts");
const CLIENT = read("app/tools/roofing/jobCard/JobCardClient.tsx");
const BRIEF = read("app/tools/roofing/jobCard/JobCardFieldBrief.tsx");
const ROOFING = read("app/tools/roofing/RoofingClient.tsx");
const ACTIVITY = read("app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx");
const ATTENTION_HOOK = read("app/lib/useJobAttention.ts");
const SAVED = read("app/tools/roofing/saved/SavedClient.tsx");

function situation(overrides: Partial<JobCardOverviewSituationInput> = {}) {
  return resolveJobCardOverviewSituation({
    stage: "proposal",
    disposition: "active",
    hasDraftProposal: false,
    hasSentProposal: true,
    acceptedAwaitingApproval: false,
    signed: false,
    hasActiveSchedule: false,
    productionStartedAt: null,
    pendingScopeChange: false,
    proposalFactsReady: true,
    remainingCents: null,
    suppressCommercial: false,
    ...overrides,
  });
}

function approveEligibility(approvalAcceptancePending: boolean) {
  return resolveCanonicalJobActionEligibilityFromFacts({
    stage: "proposal",
    disposition: "active",
    schedule: null,
    scheduleReadStatus: "ready",
    approvalAcceptancePending,
  }).canApproveJob;
}

describe("acceptance reader contract", () => {
  test("a failed read rejects instead of returning []", () => {
    assert.match(READER, /class ProposalAcceptanceReadError/);
    assert.doesNotMatch(READER, /if \(error\) return \[\]/);
    assert.doesNotMatch(READER, /if \(!supabase\) return \[\]/);
    assert.match(READER, /if \(error\) \{\s*throw new ProposalAcceptanceReadError/);
  });

  test("every contractor caller handles rejection without clearing facts", () => {
    for (const [name, src] of [
      ["JobCardClient", CLIENT],
      ["RoofingClient", ROOFING],
      ["Activity panel", ACTIVITY],
    ] as const) {
      assert.doesNotMatch(src, /void listJobProposalAcceptances\([^)]*\)\.then\(\(acceptances\)/, name);
      assert.match(src, /listJobProposalAcceptances\([^)]*\)\.then\(\s*\(acceptances\)[\s\S]{0,700}\(err\) =>/, name);
    }
  });
});

describe("acceptance read state", () => {
  test("A: initial loading is not known facts", () => {
    const s = createInitialProposalAcceptanceReadState();
    assert.equal(proposalAcceptanceFactsKnown(s), false);
    assert.equal(proposalAcceptanceFactsUnavailable(s), false);
  });

  test("B: a successful empty read is known (confirmed zero)", () => {
    const s = applyProposalAcceptanceReadSuccess();
    assert.equal(proposalAcceptanceFactsKnown(s), true);
    assert.deepEqual(acceptedProposalIdsFromRows([]), {});
  });

  test("D: an initial failure is unavailable, never known-empty", () => {
    const s = applyProposalAcceptanceReadFailure(createInitialProposalAcceptanceReadState());
    assert.equal(s.status, "error");
    assert.equal(proposalAcceptanceFactsKnown(s), false);
    assert.equal(proposalAcceptanceFactsUnavailable(s), true);
  });

  test("E: a refresh failure keeps last-known resolved truth", () => {
    const refreshing = beginProposalAcceptanceRead(applyProposalAcceptanceReadSuccess());
    assert.equal(proposalAcceptanceFactsKnown(refreshing), true);
    const failed = applyProposalAcceptanceReadFailure(refreshing);
    assert.equal(proposalAcceptanceFactsKnown(failed), true);
    assert.equal(proposalAcceptanceFactsUnavailable(failed), false);
    assert.match(CLIENT, /\(err\) => \{[\s\S]{0,200}setAcceptanceRead\(applyProposalAcceptanceReadFailure\);\s*\}/);
  });

  test("F: a later success recovers from failure", () => {
    const failed = applyProposalAcceptanceReadFailure(createInitialProposalAcceptanceReadState());
    const retried = beginProposalAcceptanceRead(failed);
    assert.equal(proposalAcceptanceFactsKnown(retried), false);
    const recovered = applyProposalAcceptanceReadSuccess();
    assert.equal(proposalAcceptanceFactsKnown(recovered), true);
    assert.match(CLIENT, /\[jobCardSecondaryEnabled, currentJobId, acceptanceReadAttempt\]/);
    assert.match(CLIENT, /setAcceptanceReadAttempt\(\(n\) => n \+ 1\)/);
  });

  test("accepted ids come only from real acceptance rows", () => {
    assert.deepEqual(
      acceptedProposalIdsFromRows([{ proposal_id: " p1 " }, { proposal_id: null }, { proposal_id: "" }]),
      { p1: true }
    );
  });
});

describe("Job Card Overview semantics", () => {
  test("A: unresolved facts never claim Proposal sent", () => {
    const s = situation({ proposalFactsReady: false });
    assert.equal(s.kind, "loading");
    assert.equal(s.headline, null);
  });

  test("B: resolved empty may truthfully show Proposal sent", () => {
    assert.equal(situation().kind, "proposal_sent");
  });

  test("C: real pending acceptance shows accepted + awaiting approval, even before other reads settle", () => {
    for (const ready of [true, false]) {
      const s = situation({ acceptedAwaitingApproval: true, proposalFactsReady: ready });
      assert.equal(s.kind, "accepted_awaiting_approval");
      assert.equal(s.headline, "Customer accepted proposal");
      assert.ok(s.details.includes(JOB_CARD_AWAITING_CONTRACTOR_APPROVAL));
    }
  });

  test("D: a failed read is an honest unavailable state, not Proposal sent", () => {
    const s = situation({ proposalFactsReady: false, proposalFactsUnavailable: true });
    assert.equal(s.kind, "proposal_facts_unavailable");
    assert.equal(s.headline, JOB_CARD_SITUATION_PROPOSAL_FACTS_UNAVAILABLE);
    assert.doesNotMatch([s.headline, ...s.details].join(" "), /Proposal sent|No proposal|waiting on the customer/i);
  });

  test("Overview readiness requires both acceptance and attention truth", () => {
    assert.match(CLIENT, /proposalFactsReady:\s*acceptanceFactsReady && attentionFactsReady && proposalListSettled/);
    assert.match(CLIENT, /jobAttention\.status === "ready-empty" \|\| jobAttention\.status === "ready-items"/);
    assert.match(CLIENT, /proposalFactsUnavailable:\s*proposalAcceptanceFactsUnavailable\(acceptanceRead\) \|\|\s*jobAttention\.status === "error"/);
    assert.doesNotMatch(CLIENT, /setAcceptanceFactsReady\(true\)/);
  });

  test("field brief shows unavailable, not 'No authorized scope on file', when the read failed", () => {
    const vm = buildFieldBriefViewModel({ authorizedWorkStatus: "error" } as Parameters<typeof buildFieldBriefViewModel>[0]);
    assert.equal(vm.authorizedWork.status, "error");
    assert.match(BRIEF, /scopeUnknown \? \([\s\S]{0,200}data-field-brief-scope-unavailable/);
    assert.match(CLIENT, /authorizedWorkStatus: proposalAcceptanceFactsUnavailable\(acceptanceRead\)\s*\?\s*"error"/);
  });
});

describe("Approve eligibility is not weakened", () => {
  test("G: Approve requires canonical pending acceptance; failure never grants it", () => {
    assert.equal(approveEligibility(false), false);
    assert.equal(approveEligibility(true), true);
    assert.equal(findApproveJobAcceptanceItem([]), null);
    assert.match(CLIENT, /approvalAcceptancePending: Boolean\(\s*findApproveJobAcceptanceItem\(jobAttention\.items\)\s*\)/);
  });
});

describe("H: Board and Job Card share one acceptance authority", () => {
  test("both derive Approve from attention acceptance items through the same eligibility", () => {
    assert.equal(approvalPendingFromAttentionType("acceptance_confirmation_required"), true);
    assert.equal(approvalPendingFromAttentionType(null), false);
    assert.match(SAVED, /approvalAcceptancePending: approvalPendingFromAttentionType\(/);
  });

  test("neither attention read collapses failure to empty", () => {
    const failed = applyAttentionDetailFetchResult({
      previousItems: [{ id: "a1" }],
      previousSelectedId: "a1",
      result: { ok: false, error: "boom" },
    });
    assert.equal(failed.status, "error");
    assert.deepEqual(failed.items, [{ id: "a1" }]);
    // Board summaries only replace last-known truth on a successful read.
    assert.match(ATTENTION_HOOK, /if \(result\.ok\) \{\s*setSummaries\(result\.summaries\);/);
  });
});
