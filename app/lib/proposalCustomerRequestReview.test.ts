/**
 * R3B3 — Contractor customer request review tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerRequestReview.test.ts app/lib/proposalCustomerRequestPersistence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1,
  parseProposalCustomerRequestStatusUpdateRpcResult,
  updateProposalCustomerRequestStatusViaRpc,
  ProposalCustomerRequestStoreError,
  type ProposalCustomerRequestContractorRow,
} from "./proposalCustomerRequestPersistence";
import {
  getProposalCustomerRequestsForContractor,
  updateProposalCustomerRequestStatusForContractor,
} from "./proposalCustomerRequestReview";
import {
  CUSTOMER_REQUEST_BUILDER_BANNER_HINT,
  CUSTOMER_REQUEST_DISMISS_LABEL,
  CUSTOMER_REQUEST_MARK_SEEN_LABEL,
  CUSTOMER_REQUEST_REVIEW_FORBIDDEN_COPY,
  CUSTOMER_REQUEST_REVIEW_SECTION_SUBTITLE,
  CUSTOMER_REQUEST_REVIEW_SECTION_TITLE,
  assertCustomerRequestReviewCopySafe,
  buildCustomerRequestReviewItemView,
  formatCustomerRequestedHeadline,
} from "./proposalCustomerRequestReviewViewModel";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_COMPANY_ID = "77777777-7777-4777-8777-777777777777";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OPTION_ID = "55555555-5555-4555-8555-555555555555";
const SELECTED_OPTION_ID = "66666666-6666-4666-8666-666666666666";
const JOB_ID = "88888888-8888-4888-8888-888888888888";

const UPDATE_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260723_034_update_proposal_customer_request_status_rpc.sql"
);

function sampleRow(
  overrides: Partial<ProposalCustomerRequestContractorRow> = {}
): ProposalCustomerRequestContractorRow {
  return {
    id: REQUEST_ID,
    intent: "request_package",
    status: "new",
    requested_option_id: OPTION_ID,
    requested_option_label: "Standard",
    message: "Please call me",
    customer_name: "Pat",
    customer_email: "pat@example.com",
    customer_phone: null,
    created_at: "2026-07-22T12:00:00.000Z",
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    ...overrides,
  };
}

describe("R3B3 update status migration contract", () => {
  const sql = readFileSync(UPDATE_MIGRATION_PATH, "utf8");

  test("creates authenticated status update RPC with allowed transitions only", () => {
    assert.match(sql, /create or replace function public\.update_proposal_customer_request_status_v1/);
    assert.match(sql, /new → seen \| dismissed/);
    assert.match(sql, /seen → dismissed/);
    assert.match(sql, /grant execute[\s\S]*to authenticated/);
    assert.match(sql, /v_next_status not in \('seen', 'dismissed'\)/);
    assert.match(
      sql,
      /'accepted', 'approved', 'signed', 'paid', 'won', 'scheduled'/
    );
    assert.doesNotMatch(sql, /v_next_status in \('accepted'/);
    assert.doesNotMatch(sql, /set status = 'approved'/);
  });

  test("RPC must not mutate proposal/job/package truth", () => {
    assert.match(sql, /must not mutate proposal\/job truth/);
    assert.match(sql, /proposal_status_unchanged/);
    assert.match(sql, /selected_option_id_unchanged/);
    assert.match(sql, /job_stage_unchanged/);
    assert.doesNotMatch(sql, /update public\.proposals\b/);
    assert.doesNotMatch(sql, /update public\.jobs\b/);
    assert.doesNotMatch(sql, /update public\.proposal_options\b/);
    assert.doesNotMatch(sql, /insert into public\.proposal_events/);
  });

  test("requires company membership via auth.uid", () => {
    assert.match(sql, /auth\.uid\(\)/);
    assert.match(sql, /company_memberships/);
    assert.match(sql, /'forbidden'/);
  });
});

describe("parseProposalCustomerRequestStatusUpdateRpcResult", () => {
  test("parses success with unchanged proof fields", () => {
    const parsed = parseProposalCustomerRequestStatusUpdateRpcResult({
      ok: true,
      request_id: REQUEST_ID,
      status: "seen",
      previous_status: "new",
      proposal_id: PROPOSAL_ID,
      proposal_version_id: VERSION_ID,
      proposal_status_unchanged: "sent",
      selected_option_id_unchanged: SELECTED_OPTION_ID,
      job_stage_unchanged: "proposal",
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.status, "seen");
      assert.equal(parsed.proposal_status_unchanged, "sent");
      assert.equal(parsed.selected_option_id_unchanged, SELECTED_OPTION_ID);
      assert.equal(parsed.job_stage_unchanged, "proposal");
    }
  });

  test("parses invalid_transition and invalid_status failures", () => {
    assert.deepEqual(
      parseProposalCustomerRequestStatusUpdateRpcResult({
        ok: false,
        code: "invalid_transition",
      }),
      { ok: false, code: "invalid_transition" }
    );
    assert.deepEqual(
      parseProposalCustomerRequestStatusUpdateRpcResult({
        ok: false,
        code: "invalid_status",
      }),
      { ok: false, code: "invalid_status" }
    );
  });
});

describe("updateProposalCustomerRequestStatusViaRpc", () => {
  test("calls update RPC with request id and status only", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> | null = null;
    const supabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcName = name;
        rpcArgs = args;
        return {
          data: {
            ok: true,
            request_id: REQUEST_ID,
            status: "seen",
            previous_status: "new",
            proposal_id: PROPOSAL_ID,
            proposal_version_id: VERSION_ID,
            proposal_status_unchanged: "sent",
            selected_option_id_unchanged: SELECTED_OPTION_ID,
            job_stage_unchanged: "proposal",
          },
          error: null,
        };
      },
    };

    const result = await updateProposalCustomerRequestStatusViaRpc(supabase as never, {
      requestId: REQUEST_ID,
      status: "seen",
    });

    assert.equal(rpcName, UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1);
    assert.deepEqual(rpcArgs, {
      p_request_id: REQUEST_ID,
      p_status: "seen",
    });
    assert.equal(result.ok, true);
  });

  test("rejects accepted/approved as review status before RPC", async () => {
    await assert.rejects(
      () =>
        updateProposalCustomerRequestStatusViaRpc({} as never, {
          requestId: REQUEST_ID,
          status: "accepted" as never,
        }),
      ProposalCustomerRequestStoreError
    );
  });
});

describe("getProposalCustomerRequestsForContractor", () => {
  test("returns contractor-safe views for matching company/proposal", async () => {
    const result = await getProposalCustomerRequestsForContractor(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      {
        getProposal: async () =>
          ({
            id: PROPOSAL_ID,
            company_id: COMPANY_ID,
            job_id: JOB_ID,
            status: "sent",
            selected_option_id: SELECTED_OPTION_ID,
          }) as never,
        listRequests: async (input) => {
          assert.equal(input.company_id, COMPANY_ID);
          assert.equal(input.proposal_id, PROPOSAL_ID);
          return [sampleRow()];
        },
      }
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.requests.length, 1);
      assert.equal(result.requests[0]?.headline, "Customer requested Standard");
      assert.equal(result.requests[0]?.statusPill, "New request");
      assert.equal(
        "public_access_token_id" in (result.requests[0] as object),
        false
      );
    }
  });

  test("rejects when proposal belongs to another job", async () => {
    const result = await getProposalCustomerRequestsForContractor(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      {
        getProposal: async () =>
          ({
            id: PROPOSAL_ID,
            company_id: COMPANY_ID,
            job_id: "99999999-9999-4999-8999-999999999999",
          }) as never,
        listRequests: async () => [sampleRow()],
      }
    );
    assert.deepEqual(result, { ok: false, error: "invalid_proposal" });
  });

  test("unauthorized company cannot read via missing proposal", async () => {
    const result = await getProposalCustomerRequestsForContractor(
      { companyId: OTHER_COMPANY_ID, proposalId: PROPOSAL_ID },
      {
        getProposal: async () => null,
        listRequests: async () => {
          throw new Error("should not list");
        },
      }
    );
    assert.deepEqual(result, { ok: false, error: "invalid_proposal" });
  });
});

describe("updateProposalCustomerRequestStatusForContractor", () => {
  test("mark seen works and surfaces unchanged proof", async () => {
    const result = await updateProposalCustomerRequestStatusForContractor(
      {
        companyId: COMPANY_ID,
        requestId: REQUEST_ID,
        status: "seen",
        proposalId: PROPOSAL_ID,
      },
      {
        getProposal: async () =>
          ({ id: PROPOSAL_ID, company_id: COMPANY_ID, job_id: JOB_ID }) as never,
        listRequests: async () => [sampleRow({ status: "seen" })],
        updateStatus: async () => ({
          ok: true,
          request_id: REQUEST_ID,
          status: "seen",
          previous_status: "new",
          proposal_id: PROPOSAL_ID,
          proposal_version_id: VERSION_ID,
          proposal_status_unchanged: "sent",
          selected_option_id_unchanged: SELECTED_OPTION_ID,
          job_stage_unchanged: "proposal",
        }),
      }
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.request.status, "seen");
      assert.equal(result.proposal_status_unchanged, "sent");
      assert.equal(result.selected_option_id_unchanged, SELECTED_OPTION_ID);
      assert.equal(result.job_stage_unchanged, "proposal");
    }
  });

  test("dismiss works", async () => {
    const result = await updateProposalCustomerRequestStatusForContractor(
      {
        companyId: COMPANY_ID,
        requestId: REQUEST_ID,
        status: "dismissed",
      },
      {
        getProposal: async () => null,
        listRequests: async () => [sampleRow({ status: "dismissed" })],
        updateStatus: async () => ({
          ok: true,
          request_id: REQUEST_ID,
          status: "dismissed",
          previous_status: "seen",
          proposal_id: PROPOSAL_ID,
          proposal_version_id: VERSION_ID,
          proposal_status_unchanged: "sent",
          selected_option_id_unchanged: SELECTED_OPTION_ID,
          job_stage_unchanged: "proposal",
        }),
      }
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.request.status, "dismissed");
  });

  test("invalid transition rejects", async () => {
    const result = await updateProposalCustomerRequestStatusForContractor(
      {
        companyId: COMPANY_ID,
        requestId: REQUEST_ID,
        status: "seen",
      },
      {
        getProposal: async () => null,
        listRequests: async () => [],
        updateStatus: async () => ({ ok: false, code: "invalid_transition" }),
      }
    );
    assert.deepEqual(result, { ok: false, error: "invalid_transition" });
  });

  test("cannot set accepted/approved status", async () => {
    const result = await updateProposalCustomerRequestStatusForContractor(
      {
        companyId: COMPANY_ID,
        requestId: REQUEST_ID,
        status: "accepted" as never,
      },
      {
        getProposal: async () => null,
        listRequests: async () => [],
        updateStatus: async () => {
          throw new Error("should not call RPC");
        },
      }
    );
    assert.deepEqual(result, { ok: false, error: "invalid_status" });
  });
});

describe("R3B3 contractor copy", () => {
  test("Job Card / Preview / Builder use request language only", () => {
    const blobs = [
      formatCustomerRequestedHeadline("Standard"),
      CUSTOMER_REQUEST_MARK_SEEN_LABEL,
      CUSTOMER_REQUEST_DISMISS_LABEL,
      CUSTOMER_REQUEST_REVIEW_SECTION_TITLE,
      CUSTOMER_REQUEST_REVIEW_SECTION_SUBTITLE,
      CUSTOMER_REQUEST_BUILDER_BANNER_HINT,
      buildCustomerRequestReviewItemView(sampleRow()).headline,
      buildCustomerRequestReviewItemView(sampleRow()).statusPill,
    ].join("\n");

    assert.match(blobs, /Customer requested Standard/);
    assert.match(blobs, /New request/);
    assert.match(blobs, /Mark seen/);
    assert.match(blobs, /Dismiss/);
    assert.match(blobs, /Review before revising/);
    assert.ok(assertCustomerRequestReviewCopySafe(blobs));
    assert.doesNotMatch(blobs, CUSTOMER_REQUEST_REVIEW_FORBIDDEN_COPY);
  });

  test("UI sources avoid Accept/Approve/Sign/Pay/Won language", () => {
    const uiSources = [
      "app/tools/roofing/jobCard/JobCardProposalsTab.tsx",
      "app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx",
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewCustomerRequestsSection.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderCustomerRequestBanner.tsx",
      "app/components/proposals/CustomerRequestReviewCard.tsx",
      "app/api/proposals/customer-requests/route.ts",
    ].map((path) => readFileSync(join(process.cwd(), path), "utf8"));

    for (const source of uiSources) {
      assert.doesNotMatch(source, CUSTOMER_REQUEST_REVIEW_FORBIDDEN_COPY);
      assert.doesNotMatch(
        source,
        /Request accepted|Package confirmed|Proposal approved|Contract accepted/i
      );
    }

    assert.match(
      uiSources[0]!,
      /data-jobcard-customer-request|CustomerRequestReviewCard/
    );
    assert.match(uiSources[2]!, /data-preview-customer-requests/);
    assert.match(uiSources[3]!, /data-builder-customer-request-banner/);
    assert.match(
      uiSources[3]!,
      /CUSTOMER_REQUEST_BUILDER_BANNER_HINT/
    );
  });

  test("status update path does not touch Jobs Board or package selector", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/proposals/customer-requests/route.ts"),
      "utf8"
    );
    const review = readFileSync(
      join(process.cwd(), "app/lib/proposalCustomerRequestReview.ts"),
      "utf8"
    );
    const banner = readFileSync(
      join(
        process.cwd(),
        "app/tools/roofing/proposals/builder/ProposalBuilderCustomerRequestBanner.tsx"
      ),
      "utf8"
    );

    for (const source of [route, review]) {
      assert.doesNotMatch(source, /jobsBoard|getBoardColumn|jobs\.stage/);
      assert.doesNotMatch(source, /selected_option_id\s*=/);
      assert.doesNotMatch(source, /proposals\.status\s*=/);
    }
    assert.doesNotMatch(banner, /ProposalBuilderPackageSelector|selectedOptionId/);
    assert.match(banner, /CUSTOMER_REQUEST_BUILDER_BANNER_HINT/);
    assert.equal(
      CUSTOMER_REQUEST_BUILDER_BANNER_HINT,
      "Review before revising or contacting the customer."
    );
  });
});
