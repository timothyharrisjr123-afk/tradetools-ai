/**
 * R18C4C — proposalPublicReviewReadiness tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicReviewReadiness.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildPublicProposalReviewUrl,
  buildPublicReviewReadinessViewModel,
  hasPublicProposalSentSnapshot,
  PUBLIC_REVIEW_DEFERRED_SEND,
  PUBLIC_REVIEW_LINK_READY_BODY,
  PUBLIC_REVIEW_NO_SENT_SNAPSHOT_BODY,
  PUBLIC_REVIEW_SENT_READY_BODY,
  resolvePublicProposalSnapshotVersionId,
} from "@/app/lib/proposalPublicReviewReadiness";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const SENT_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const SIGNED_VERSION_ID = "55555555-5555-4555-8555-555555555555";

function proposal(overrides: {
  latest_sent_version_id?: string | null;
  signed_version_id?: string | null;
}) {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: "66666666-6666-4666-8666-666666666666",
    customer_id: null,
    template_id: "77777777-7777-4777-8777-777777777777",
    status: "draft" as const,
    current_draft_version_id: "88888888-8888-4888-8888-888888888888",
    latest_sent_version_id: overrides.latest_sent_version_id ?? null,
    signed_version_id: overrides.signed_version_id ?? null,
    selected_option_id: null,
    measurement_record_id: null,
    pricing_policy_id: null,
    proposal_number: null,
    title: "Roof Replacement",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-26T12:00:00.000Z",
    updated_at: "2026-06-26T12:00:00.000Z",
    draft_content_changed_at: "2026-06-26T12:00:00.000Z",
    archived_at: null,
    deleted_at: null,
  };
}

describe("resolvePublicProposalSnapshotVersionId", () => {
  test("prefers signed version over latest sent", () => {
    assert.equal(
      resolvePublicProposalSnapshotVersionId(
        proposal({ signed_version_id: SIGNED_VERSION_ID, latest_sent_version_id: SENT_VERSION_ID })
      ),
      SIGNED_VERSION_ID
    );
  });

  test("falls back to latest sent version", () => {
    assert.equal(
      resolvePublicProposalSnapshotVersionId(proposal({ latest_sent_version_id: SENT_VERSION_ID })),
      SENT_VERSION_ID
    );
  });

  test("returns null when no sent or signed snapshot", () => {
    assert.equal(resolvePublicProposalSnapshotVersionId(proposal({})), null);
    assert.equal(hasPublicProposalSentSnapshot(proposal({})), false);
  });
});

describe("buildPublicProposalReviewUrl", () => {
  test("builds encoded public review URL", () => {
    assert.equal(
      buildPublicProposalReviewUrl("https://app.example.com", "abc/def_token"),
      "https://app.example.com/p/abc%2Fdef_token"
    );
  });
});

describe("buildPublicReviewReadinessViewModel", () => {
  test("no sent snapshot disables create/open/copy", () => {
    const vm = buildPublicReviewReadinessViewModel({
      hasSentSnapshot: false,
      sessionLink: null,
    });

    assert.equal(vm.phase, "no_sent_snapshot");
    assert.equal(vm.canCreateReviewLink, false);
    assert.equal(vm.canOpenCustomerView, false);
    assert.equal(vm.canCopyReviewLink, false);
    assert.match(vm.body, /draft preview below/i);
  });

  test("sent snapshot ready enables create only", () => {
    const vm = buildPublicReviewReadinessViewModel({
      hasSentSnapshot: true,
      sessionLink: null,
    });

    assert.equal(vm.phase, "sent_ready");
    assert.equal(vm.canCreateReviewLink, true);
    assert.equal(vm.canOpenCustomerView, false);
    assert.equal(vm.canCopyReviewLink, false);
    assert.equal(vm.body, PUBLIC_REVIEW_SENT_READY_BODY);
  });

  test("session link enables open/copy", () => {
    const vm = buildPublicReviewReadinessViewModel({
      hasSentSnapshot: true,
      sessionLink: {
        publicUrl: "https://app.example.com/p/token-value",
        tokenPrefix: "token-va",
        expiresAt: "2099-12-31T23:59:59.000Z",
      },
    });

    assert.equal(vm.phase, "link_ready");
    assert.equal(vm.canOpenCustomerView, true);
    assert.equal(vm.canCopyReviewLink, true);
    assert.equal(vm.body, PUBLIC_REVIEW_LINK_READY_BODY);
  });

  test("deferred actions remain disabled labels", () => {
    const vm = buildPublicReviewReadinessViewModel({
      hasSentSnapshot: true,
      sessionLink: null,
    });

    assert.deepEqual(
      vm.deferredActions.map((action) => action.label),
      [
        PUBLIC_REVIEW_DEFERRED_SEND,
        "Signature — coming later",
        "PDF — coming later",
      ]
    );
  });

  test("copy avoids sent-to-customer language", () => {
    const values = [
      PUBLIC_REVIEW_NO_SENT_SNAPSHOT_BODY,
      PUBLIC_REVIEW_SENT_READY_BODY,
      PUBLIC_REVIEW_LINK_READY_BODY,
      PUBLIC_REVIEW_DEFERRED_SEND,
    ].join("\n");

    assert.doesNotMatch(values, /sent to customer/i);
    assert.doesNotMatch(values, /email sent/i);
    assert.doesNotMatch(values, /customer notified/i);
  });
});
