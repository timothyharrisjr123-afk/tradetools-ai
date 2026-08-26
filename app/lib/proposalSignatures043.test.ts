/**
 * R3D — Proposal signatures 043 contract.
 *
 * Run: npx tsx --test app/lib/proposalSignatures043.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1 } from "./proposalCustomerRequestPersistence";
import { RECORD_PROPOSAL_ACCEPTANCE_RPC_V1 } from "./proposalAcceptanceTypes";
import {
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_AND_SIGN_CTA,
  PROPOSAL_CUSTOMER_PACKET_SIGNED_TITLE,
  PROPOSAL_CUSTOMER_PACKET_SIGN_PROPOSAL_CTA,
  PROPOSAL_SIGNATURE_ACKNOWLEDGEMENT_KEY,
  PROPOSAL_SIGNATURE_ACKNOWLEDGEMENT_TEXT,
  RECORD_PROPOSAL_SIGNATURE_RPC_V1,
} from "./proposalSignatureTypes";
import { parseProposalSignatureRecordResult } from "./proposalSignaturePersistence";
import { PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA } from "./proposalCustomerPacketViewModel";
import { formatJobCardContractorProposalStatusLabel } from "../tools/roofing/jobCard/jobCardProposalsTabModel";
import type { ProposalRecordStatusSummary } from "./proposalRecordTypes";

const ROOT = process.cwd();
const SQL_043 = join(ROOT, "supabase/migrations/20260816_043_proposal_signatures.sql");
const SQL_042 = join(
  ROOT,
  "supabase/migrations/20260816_042_proposal_freeze_timestamp_authority.sql"
);
const SQL_041 = join(
  ROOT,
  "supabase/migrations/20260816_041_proposal_draft_content_changed_at.sql"
);
const SQL_040 = join(
  ROOT,
  "supabase/migrations/20260816_040_proposal_formal_acceptance.sql"
);
const SQL_039 = join(
  ROOT,
  "supabase/migrations/20260816_039_proposal_formal_acceptance.sql"
);
const SQL_038 = join(
  ROOT,
  "supabase/migrations/20260816_038_job_lifecycle_foundation.sql"
);
const SQL_044 = join(ROOT, "supabase/migrations/20260816_044_proposal_signatures.sql");

const HASH_038 =
  "46027df3711a52814234d551ed9e5a08661eeb8cebe377ce4e58c694a95fd40b";
const HASH_040 =
  "0c9929393e1662626357e72521792fa0a805e169de242073f43c5bd75be81256";
const HASH_041 =
  "fc5f394c67f7b4d8e5417db4bf2c63d0fb8ff79088f15b0c816bdc5c7409c883";
const HASH_042 =
  "2d0d7210b0e8002e027b4f5c1b2bf167fac434df26dfe2b76f357668aae1ee20";

const sql043 = readFileSync(SQL_043, "utf8");
const rpcFn = sql043.slice(
  sql043.indexOf("create or replace function public.record_proposal_signature_v1")
);

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function summary(partial: Partial<ProposalRecordStatusSummary> & { id: string }) {
  return {
    id: partial.id,
    job_id: partial.job_id ?? "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    status: partial.status ?? "draft",
    title: partial.title ?? "Roof replacement",
    proposal_number: null,
    template_id: "tmpl-roof",
    selected_option_id: null,
    latest_sent_version_id:
      partial.latest_sent_version_id ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    signed_version_id: partial.signed_version_id ?? null,
    created_at: null,
    updated_at: "2026-08-16T12:00:00.000Z",
    draft_content_changed_at: "2026-08-16T12:00:00.000Z",
  } satisfies ProposalRecordStatusSummary;
}

describe("043 migration discipline", () => {
  test("filename exists; 039 absent; 038-042 hashes unchanged; no 044", () => {
    assert.equal(existsSync(SQL_043), true);
    assert.equal(existsSync(SQL_039), false);
    assert.equal(existsSync(SQL_044), false);
    assert.equal(sha256File(SQL_038), HASH_038);
    assert.equal(sha256File(SQL_040), HASH_040);
    assert.equal(sha256File(SQL_041), HASH_041);
    assert.equal(sha256File(SQL_042), HASH_042);
    assert.match(sql043, /039 remains reserved/);
    assert.doesNotMatch(sql043, /create table if not exists public\.proposal_signers/);
  });
});

describe("043 schema / security / RPC", () => {
  test("proposal_signatures binds acceptance and frozen version/option", () => {
    assert.match(sql043, /create table if not exists public\.proposal_signatures/);
    assert.match(sql043, /proposal_acceptance_id uuid not null/);
    assert.match(sql043, /public_access_token_id uuid not null/);
    assert.match(sql043, /unique \(company_id, proposal_acceptance_id, signer_slot\)/);
    assert.match(sql043, /signer_slot = 'customer_primary'/);
    assert.match(sql043, /source = 'public_token'/);
    assert.match(sql043, /method = 'drawn_signature'/);
    assert.match(
      sql043,
      /proposal_signatures binding must match the acceptance row/
    );
  });

  test("append-only immutability and RLS", () => {
    assert.match(sql043, /proposal_signatures rows cannot be updated/);
    assert.match(sql043, /proposal_signatures rows cannot be deleted/);
    assert.match(sql043, /enable row level security/);
    assert.match(sql043, /grant select on table public\.proposal_signatures to authenticated/);
    assert.match(sql043, /revoke all on table public\.proposal_signatures from anon/);
    assert.doesNotMatch(
      sql043,
      /create policy "proposal_signatures_insert_company_scope"/
    );
  });

  test("record_proposal_signature_v1 is atomic accept+sign and never writes stage", () => {
    assert.equal(RECORD_PROPOSAL_SIGNATURE_RPC_V1, "record_proposal_signature_v1");
    assert.match(rpcFn, /record_proposal_acceptance_v1/);
    const markIdx = rpcFn.indexOf("proposal_signature_mark_error_v1");
    const acceptIdx = rpcFn.indexOf("record_proposal_acceptance_v1");
    assert.equal(markIdx > 0 && acceptIdx > markIdx, true);
    assert.match(rpcFn, /raise exception 'proposal signature must not change job stage'/);
    assert.match(
      rpcFn,
      /raise exception 'proposal signature must not write proposals.signed_version_id'/
    );
    assert.doesNotMatch(rpcFn, /jobs\.stage\s*=/);
    assert.doesNotMatch(rpcFn, /signed_version_id\s*=/);
    assert.match(rpcFn, /grant execute[\s\S]*to service_role/);
    assert.match(rpcFn, /revoke all on function public\.record_proposal_signature_v1/);
  });

  test("ack key/text and token reuse policy", () => {
    assert.equal(
      PROPOSAL_SIGNATURE_ACKNOWLEDGEMENT_KEY,
      "fielddive_proposal_signature_v1"
    );
    assert.equal(
      PROPOSAL_SIGNATURE_ACKNOWLEDGEMENT_TEXT,
      "I accept and sign this proposal as shown, including the selected package and total."
    );
    assert.match(sql043, /acknowledgement_key = 'fielddive_proposal_signature_v1'/);
    assert.match(sql043, /Same-version resend tokens reuse the logical acceptance and signature row/i);
    assert.match(rpcFn, /when unique_violation then/);
    assert.match(rpcFn, /idempotent_replay/);
    assert.match(rpcFn, /if coalesce\(\(v_accept->>'ok'\)::boolean, false\) is not true then/);
    assert.doesNotMatch(sql043, /create table if not exists public\.proposal_pdf/);
    assert.doesNotMatch(sql043, /storage\.buckets/);
  });
});

describe("R3D public / API / request-vs-sign", () => {
  test("Signature infrastructure retained; default public path uses confirm/pay", () => {
    assert.equal(PROPOSAL_CUSTOMER_PACKET_ACCEPT_AND_SIGN_CTA, "Accept & sign");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_SIGN_PROPOSAL_CTA, "Sign proposal");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_SIGNED_TITLE, "Proposal signed");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA, "Request this package");
    const customerActions = readFileSync(
      join(ROOT, "app/components/proposal-packet/ProposalPacketCustomerActions.tsx"),
      "utf8"
    );
    const legacyActions = readFileSync(
      join(ROOT, "app/components/proposal-packet/ProposalPacketPackageInterestActions.tsx"),
      "utf8"
    );
    const modal = readFileSync(
      join(ROOT, "app/components/proposal-packet/ProposalPacketSignModal.tsx"),
      "utf8"
    );
    assert.match(customerActions, /data-proposal-cta="confirm-proposal"/);
    assert.doesNotMatch(customerActions, /accept-and-sign/);
    assert.doesNotMatch(customerActions, /sign-proposal/);
    assert.match(customerActions, /\/api\/proposals\/accept/);
    assert.match(legacyActions, /data-proposal-cta="accept-and-sign"/);
    assert.match(modal, /\/api\/proposals\/sign/);
    assert.doesNotMatch(modal, /\/api\/proposals\/accept/);
    assert.doesNotMatch(customerActions, /Approve job|job stage|attention_id|signature_id/i);
  });

  test("sign API hashes token server-side and does not take a package id", () => {
    const route = readFileSync(join(ROOT, "app/api/proposals/sign/route.ts"), "utf8");
    assert.match(route, /recordProposalSignature/);
    assert.doesNotMatch(route, /requestedOptionId|selectedOptionId|selected_option_id/);
    assert.match(route, /Token is hashed server-side/);
    assert.match(route, /Signature never moves Job stage/);
    assert.doesNotMatch(route, /from\("proposal_signatures"\)/);
  });

  test("Request this package remains a separate owner", () => {
    assert.notEqual(
      RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1,
      RECORD_PROPOSAL_SIGNATURE_RPC_V1
    );
    assert.notEqual(
      RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1,
      RECORD_PROPOSAL_ACCEPTANCE_RPC_V1
    );
    const requestRoute = readFileSync(
      join(ROOT, "app/api/proposals/customer-request/route.ts"),
      "utf8"
    );
    assert.doesNotMatch(requestRoute, /record_proposal_signature_v1/);
    assert.doesNotMatch(requestRoute, /record_proposal_acceptance_v1/);
  });
});

describe("R3D persistence parse / no internal leak", () => {
  test("success parse keeps signed truth without exposing drawn mark", () => {
    const parsed = parseProposalSignatureRecordResult({
      ok: true,
      signature_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      acceptance_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
      token_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
      company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04",
      job_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05",
      proposal_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06",
      proposal_version_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07",
      proposal_option_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08",
      signer_slot: "customer_primary",
      signer_printed_name: "Jane Homeowner",
      signed_at: "2026-08-16T18:00:00.000Z",
      accepted_at: "2026-08-16T18:00:00.000Z",
      accepted_option_label: "Premium",
      accepted_total_cents: 1850000,
      acknowledgement_key: "fielddive_proposal_signature_v1",
      job_stage: "proposal",
      stage_entered_at: "2026-08-16T12:00:00.000Z",
      job_stage_unchanged: true,
      signed_version_id_unchanged: null,
      idempotent_replay: false,
      acceptance_replay: false,
      attention_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09",
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.job_stage, "proposal");
      assert.equal(parsed.job_stage_unchanged, true);
      assert.equal(parsed.signed_version_id_unchanged, null);
    }
  });

  test("blank name and invalid mark codes are customer-safe failures", () => {
    assert.deepEqual(parseProposalSignatureRecordResult({ ok: false, code: "invalid_signer_name" }), {
      ok: false,
      code: "invalid_signer_name",
    });
    assert.deepEqual(parseProposalSignatureRecordResult({ ok: false, code: "invalid_mark" }), {
      ok: false,
      code: "invalid_mark",
    });
    assert.deepEqual(parseProposalSignatureRecordResult({ ok: false, code: "superseded" }), {
      ok: false,
      code: "superseded",
    });
  });
});

describe("Job Card shared proposal-state owner", () => {
  test("accepted unsigned is Accepted on strip; signed is Signed", () => {
    const sent = summary({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
    const facts = { latestSentFrozenAt: "2026-08-16T12:00:00.000Z" };
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [sent],
        sentFactsByProposalId: { [sent.id]: facts },
      }),
      "Sent proposal"
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [sent],
        sentFactsByProposalId: { [sent.id]: facts },
        acceptedProposalIds: { [sent.id]: true },
      }),
      "Accepted"
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [sent],
        sentFactsByProposalId: { [sent.id]: facts },
        acceptedProposalIds: { [sent.id]: true },
        signedProposalIds: { [sent.id]: true },
      }),
      "Signed"
    );
  });
});

describe("Public orchestrator signed overlay", () => {
  test("token-bound signed fact becomes customer-safe signed packet state", () => {
    const orch = readFileSync(
      join(ROOT, "app/lib/proposalPublicAccessOrchestrator.ts"),
      "utf8"
    );
    const server = readFileSync(
      join(ROOT, "app/lib/proposalPublicAccessOrchestrator.server.ts"),
      "utf8"
    );
    assert.match(orch, /status: signedAt \? "signed" : "accepted"/);
    assert.match(orch, /signerDisplayName/);
    assert.match(server, /proposal_signatures/);
    assert.match(server, /signer_slot.*customer_primary/);
    assert.doesNotMatch(orch, /signed_version_id/);
  });
});
