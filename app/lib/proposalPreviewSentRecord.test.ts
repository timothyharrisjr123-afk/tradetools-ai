/**
 * V2F2 — Sent-record Preview mode goldens.
 * Run: npx tsx --test app/lib/proposalPreviewSentRecord.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ProposalVersionGraph } from "@/app/lib/proposalRecordStore";
import {
  PREVIEW_SENT_RECORD_MISSING_VERSION,
  PREVIEW_SENT_RECORD_NOT_FROZEN,
  PREVIEW_SENT_RECORD_STATUS_LABEL,
  asCustomerPreviewGraphFromSentRecord,
  buildProposalPreviewSentHref,
  buildProposalPreviewSentRecordChrome,
  parseProposalPreviewSentRecordRequest,
  resolveSentRecordVersionId,
  validateProposalSentRecordGraph,
} from "./proposalPreviewSentRecord";

const JOB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PROPOSAL = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const VERSION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function graph(overrides?: {
  jobId?: string;
  proposalId?: string;
  versionId?: string;
  frozenAt?: string | null;
}): ProposalVersionGraph {
  const proposalId = overrides?.proposalId ?? PROPOSAL;
  const versionId = overrides?.versionId ?? VERSION;
  return {
    proposal: {
      id: proposalId,
      company_id: "11111111-1111-4111-8111-111111111111",
      job_id: overrides?.jobId ?? JOB,
      customer_id: null,
      template_id: "66666666-6666-4666-8666-666666666666",
      status: "draft",
      current_draft_version_id: OTHER,
      latest_sent_version_id: versionId,
      signed_version_id: null,
      selected_option_id: null,
      measurement_record_id: null,
      pricing_policy_id: null,
      proposal_number: null,
      title: "Roof replacement",
      created_by: null,
      updated_by: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-23T12:00:00.000Z",
      archived_at: null,
      deleted_at: null,
    },
    version: {
      id: versionId,
      company_id: "11111111-1111-4111-8111-111111111111",
      proposal_id: proposalId,
      version_number: 2,
      version_kind: "sent",
      parent_version_id: OTHER,
      frozen_at: overrides?.frozenAt === undefined ? "2026-07-22T16:31:00.000Z" : overrides.frozenAt,
      context_echo: {},
      policy_echo: {},
      created_by: null,
      created_at: "2026-07-22T16:31:00.000Z",
    },
    pages: [],
    options: [],
    lineItems: [],
    internalSummaries: [],
  };
}

describe("parseProposalPreviewSentRecordRequest", () => {
  test("default Preview stays draft even if a version param is present", () => {
    assert.deepEqual(
      parseProposalPreviewSentRecordRequest({ view: null, version: VERSION }),
      { mode: "draft" }
    );
  });

  test("view=sent without a version UUID is invalid and must not become draft", () => {
    const parsed = parseProposalPreviewSentRecordRequest({
      view: "sent",
      version: "not-a-uuid",
    });
    assert.equal(parsed.mode, "sent_record_invalid");
  });

  test("view=sent with version UUID selects that exact record", () => {
    assert.deepEqual(parseProposalPreviewSentRecordRequest({ view: "sent", version: VERSION }), {
      mode: "sent_record",
      versionId: VERSION,
    });
  });
});

describe("sent-record href and version pointer", () => {
  test("href is the existing Preview route with explicit sent mode", () => {
    const href = buildProposalPreviewSentHref(JOB, PROPOSAL, VERSION);
    assert.match(href, /\/tools\/roofing\/proposals\/preview\?/);
    assert.match(href, /view=sent/);
    assert.match(href, new RegExp(`version=${VERSION}`));
    assert.doesNotMatch(href, /token|mint|resend/);
  });

  test("signed pointer wins over latest sent for the record to open", () => {
    assert.equal(
      resolveSentRecordVersionId({
        latestSentVersionId: VERSION,
        signedVersionId: OTHER,
      }),
      OTHER
    );
  });
});

describe("validateProposalSentRecordGraph", () => {
  test("accepts the exact frozen version for the same job/proposal", () => {
    const result = validateProposalSentRecordGraph({
      graph: graph(),
      jobId: JOB,
      proposalId: PROPOSAL,
      versionId: VERSION,
    });
    assert.equal(result.ok, true);
  });

  test("rejects a different version id without substituting latest", () => {
    const result = validateProposalSentRecordGraph({
      graph: graph({ versionId: OTHER }),
      jobId: JOB,
      proposalId: PROPOSAL,
      versionId: VERSION,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, PREVIEW_SENT_RECORD_MISSING_VERSION);
  });

  test("rejects an unfrozen version", () => {
    const result = validateProposalSentRecordGraph({
      graph: graph({ frozenAt: null }),
      jobId: JOB,
      proposalId: PROPOSAL,
      versionId: VERSION,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, PREVIEW_SENT_RECORD_NOT_FROZEN);
  });

  test("presenter adapter keeps the frozen version id and does not swap in draft", () => {
    const preview = asCustomerPreviewGraphFromSentRecord(graph());
    assert.equal(preview.version.id, VERSION);
    assert.equal(preview.version.frozen_at, "2026-07-22T16:31:00.000Z");
    assert.equal(preview.proposal.current_draft_version_id, OTHER);
    assert.deepEqual(preview.scopeDecisions, []);
  });
});

describe("sent-record chrome", () => {
  test("uses contractor-safe sent copy without internal version language", () => {
    const chrome = buildProposalPreviewSentRecordChrome({
      frozenAt: "2026-07-22T16:31:00.000Z",
      deliveryLabel: "Emailed",
    });
    assert.equal(chrome.statusLabel, PREVIEW_SENT_RECORD_STATUS_LABEL);
    assert.match(chrome.sentAtLabel ?? "", /Sent /);
    assert.doesNotMatch(chrome.sentAtLabel ?? "", /2026|frozen|snapshot|uuid/i);
    assert.equal(chrome.deliveryLabel, "Emailed");
  });
});
