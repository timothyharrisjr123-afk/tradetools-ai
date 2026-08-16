/**
 * 042 — Freeze timestamp authority.
 * DB transaction now() owns proposal_versions.frozen_at.
 * Caller/application frozen_at is not authoritative.
 *
 * Run: npx tsx --test app/lib/proposalFreezeTimestampAuthority042.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { classifyProposalAcceptanceGuard } from "./proposalAcceptanceClassifier";
import {
  deriveContractorProposalLifecycle,
  isMutableDraftDirtyAfterSentFreeze,
} from "./proposalContractorLifecycle";
import { needsSendPrepRefreeze } from "./proposalSendPrep";
import { buildJobCardProposalRowView } from "../tools/roofing/jobCard/jobCardProposalsTabModel";
import type { ProposalRecordStatusSummary } from "./proposalRecordTypes";

const ROOT = process.cwd();
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
const HASH_040 =
  "0c9929393e1662626357e72521792fa0a805e169de242073f43c5bd75be81256";
const HASH_041 =
  "fc5f394c67f7b4d8e5417db4bf2c63d0fb8ff79088f15b0c816bdc5c7409c883";

const sql042 = readFileSync(SQL_042, "utf8");
const sql041 = readFileSync(SQL_041, "utf8");
const sql040 = readFileSync(SQL_040, "utf8");
const freezeFn = sql042.slice(
  sql042.indexOf("create or replace function public.persist_proposal_send_freeze_v1")
);

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function freezeBody(): string {
  const start = freezeFn.indexOf("as $$");
  const end = freezeFn.indexOf("$$;");
  return freezeFn.slice(start, end);
}

/** 042 ownership: ignore caller frozen_at; DB now() is the freeze instant. */
function authoritativeFrozenAt(_callerFrozenAt: string | undefined, dbNow: string): string {
  return dbNow;
}

function dirty(draftContentChangedAt: string, frozenAt: string): boolean {
  return isMutableDraftDirtyAfterSentFreeze({
    draftContentChangedAt,
    latestSentFrozenAt: frozenAt,
  });
}

const IDS = {
  v1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  v2: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  option: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  proposal: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  job: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  company: "ffffffff-ffff-4fff-8fff-ffffffffffff",
};

function r3cInput(draftContentChangedAt: string, frozenAt: string) {
  return {
    versionKind: "sent",
    frozenAt,
    acceptedVersionId: IDS.v1,
    latestSentVersionId: IDS.v1,
    acceptedOptionId: IDS.option,
    frozenSelectedOptionId: IDS.option,
    proposalId: IDS.proposal,
    jobActiveProposalId: IDS.proposal,
    jobId: IDS.job,
    proposalJobId: IDS.job,
    companyId: IDS.company,
    proposalCompanyId: IDS.company,
    jobCompanyId: IDS.company,
    draftContentChangedAt,
    canonicalJobStage: "proposal",
    jobDisposition: "active",
    hasConflictingAcceptance: false,
  };
}

function summary(
  draftContentChangedAt: string,
  latestSentVersionId: string | null = IDS.v1
): ProposalRecordStatusSummary {
  return {
    id: IDS.proposal,
    job_id: IDS.job,
    status: "draft",
    title: "Roof replacement",
    proposal_number: null,
    template_id: "tmpl-roof",
    selected_option_id: IDS.option,
    latest_sent_version_id: latestSentVersionId,
    signed_version_id: null,
    created_at: null,
    updated_at: draftContentChangedAt,
    draft_content_changed_at: draftContentChangedAt,
  };
}

describe("042 migration discipline", () => {
  test("filename exists; 039 absent; 040 and 041 hashes unchanged", () => {
    assert.equal(existsSync(SQL_042), true);
    assert.equal(existsSync(SQL_039), false);
    assert.equal(sha256(sql040), HASH_040);
    assert.equal(sha256(sql041), HASH_041);
    assert.match(sql042, /039 remains absent\/reserved/);
    assert.match(sql042, /041 remains live historical truth and is not edited/);
    assert.match(sql042, /040 remains live historical truth and is not edited/);
    assert.match(sql042, /R3D is not this migration/);
  });

  test("does not rewrite historical frozen_at or replace 040/041 RPCs", () => {
    assert.doesNotMatch(sql042, /update\s+public\.proposal_versions/i);
    assert.doesNotMatch(sql042, /classify_proposal_acceptance_guard_v1/);
    assert.doesNotMatch(sql042, /confirm_proposal_acceptance_v1/);
    assert.doesNotMatch(sql042, /mint_proposal_public_access_token_v1/);
    assert.doesNotMatch(sql042, /resolve_proposal_public_access_token_v1/);
    assert.doesNotMatch(sql042, /draft_content_changed_at\s*=/);
  });
});

describe("042 freeze RPC timestamp ownership", () => {
  test("assigns v_frozen_at from transaction now() once and ignores caller frozen_at", () => {
    const body = freezeBody();
    assert.match(body, /v_frozen_at := now\(\);/);
    assert.doesNotMatch(body, /p_payload->>'frozen_at'/);
    assert.equal((body.match(/now\(\)/g) ?? []).length, 1);
    assert.doesNotMatch(body, /clock_timestamp\s*\(/);
    assert.doesNotMatch(body, /interval\s+'1/);
    assert.doesNotMatch(body, /interval\s+'60/);
    assert.doesNotMatch(sql042, /and frozen_at are required/);
  });

  test("uses the same freeze instant for sent version insert and RPC result", () => {
    const body = freezeBody();
    assert.match(body, /frozen_at,\s*[\s\S]*v_frozen_at,/);
    assert.match(body, /'frozen_at', v_frozen_at/);
    assert.match(
      body,
      /nullif\(opt->'internal_summary'->>'computed_at', ''\)::timestamptz,\s*v_frozen_at/
    );
  });

  test("snapshot_frozen occurred_at stays DB-owned default, not forced equal", () => {
    const eventInsert = freezeBody().slice(
      freezeBody().indexOf("insert into public.proposal_events")
    );
    assert.doesNotMatch(eventInsert.slice(0, 600), /occurred_at/);
    assert.match(sql042, /snapshot_frozen\.occurred_at stays DB-owned/);
  });

  test("no authenticated choose-your-freeze-time override RPC", () => {
    assert.doesNotMatch(sql042, /p_frozen_at/);
    assert.doesNotMatch(sql042, /allow_frozen_at/);
    assert.doesNotMatch(sql042, /freeze_timestamp_override/);
  });
});

describe("042 application payload no longer manufactures freeze time", () => {
  test("builder and store freeze path omit frozenAt / new Date freeze stamps", () => {
    const builder = readFileSync(join(ROOT, "app/lib/proposalSendFreezePersistence.ts"), "utf8");
    const store = readFileSync(join(ROOT, "app/lib/proposalRecordStore.ts"), "utf8");
    const persistFn = builder.slice(
      builder.indexOf("export function buildProposalSendFreezePersistPayload"),
      builder.indexOf("export function validateProposalSendFreezePersistPayload")
    );
    assert.doesNotMatch(persistFn, /new Date\(\)\.toISOString\(\)/);
    assert.doesNotMatch(persistFn, /frozen_at:/);
    assert.doesNotMatch(persistFn, /frozenAt/);
    assert.doesNotMatch(builder, /frozenAt\?: string;/);
    assert.doesNotMatch(store, /frozenAt: input\.frozenAt/);
    assert.doesNotMatch(store, /frozenAt\?: string;/);
  });
});

describe("042 immediate create → send is clean without clock fudge", () => {
  test("same-clock create then freeze is not dirty", () => {
    const createAt = "2026-08-16T20:00:00.000Z";
    const dbFreezeAt = "2026-08-16T20:00:00.000Z";
    const frozenAt = authoritativeFrozenAt("2026-08-16T19:59:59.600Z", dbFreezeAt);
    assert.equal(dirty(createAt, frozenAt), false);
    assert.equal(
      deriveContractorProposalLifecycle({
        latestSentVersionId: IDS.v1,
        draftContentChangedAt: createAt,
        latestSentFrozenAt: frozenAt,
      }).kind,
      "sent"
    );
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: false,
        draftContentChangedAt: createAt,
        sentVersionFrozenAt: frozenAt,
        pricingStale: false,
      }),
      false
    );
    const row = buildJobCardProposalRowView({
      summary: summary(createAt),
      sentFacts: { latestSentFrozenAt: frozenAt },
    });
    assert.equal(row.lifecycleKind, "sent");
    assert.equal(row.statusLabel, "Sent");
    assert.deepEqual(classifyProposalAcceptanceGuard(r3cInput(createAt, frozenAt)), {
      result: "valid_clean",
      reason: null,
    });
  });

  test("application clock behind DB cannot invent dirty", () => {
    const draftClock = "2026-08-16T20:00:00.400Z";
    const callerBehind = "2026-08-16T20:00:00.000Z";
    const dbNow = "2026-08-16T20:00:00.400Z";
    const frozenAt = authoritativeFrozenAt(callerBehind, dbNow);
    assert.equal(frozenAt, dbNow);
    assert.notEqual(frozenAt, callerBehind);
    assert.equal(dirty(draftClock, callerBehind), true);
    assert.equal(dirty(draftClock, frozenAt), false);
    assert.deepEqual(classifyProposalAcceptanceGuard(r3cInput(draftClock, frozenAt)), {
      result: "valid_clean",
      reason: null,
    });
  });

  test("application clock ahead of DB cannot hide a later real edit or invent clean freeze", () => {
    const draftClock = "2026-08-16T20:00:00.000Z";
    const callerAhead = "2099-01-01T00:00:00.000Z";
    const dbNow = "2026-08-16T20:00:00.400Z";
    const frozenAt = authoritativeFrozenAt(callerAhead, dbNow);
    assert.equal(frozenAt, dbNow);
    assert.equal(dirty(draftClock, frozenAt), false);
    const realEdit = "2026-08-16T20:00:01.000Z";
    assert.equal(dirty(realEdit, callerAhead), false);
    assert.equal(dirty(realEdit, frozenAt), true);
  });
});

describe("042 post-send edit and second send", () => {
  test("real post-send draft mutation is dirty under strict >", () => {
    const frozenAt = "2026-08-16T20:00:00.400Z";
    const editAt = "2026-08-16T20:00:00.401Z";
    assert.equal(dirty(editAt, frozenAt), true);
    assert.equal(
      deriveContractorProposalLifecycle({
        latestSentVersionId: IDS.v1,
        draftContentChangedAt: editAt,
        latestSentFrozenAt: frozenAt,
      }).kind,
      "revision_in_progress"
    );
    const row = buildJobCardProposalRowView({
      summary: summary(editAt),
      sentFacts: { latestSentFrozenAt: frozenAt },
    });
    assert.equal(row.lifecycleKind, "revision_in_progress");
    assert.equal(row.statusLabel, "Revision in progress");
    assert.deepEqual(classifyProposalAcceptanceGuard(r3cInput(editAt, frozenAt)), {
      result: "valid_review_required",
      reason: "dirty_revision",
    });
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: false,
        draftContentChangedAt: editAt,
        sentVersionFrozenAt: frozenAt,
        pricingStale: false,
      }),
      true
    );
  });

  test("second send uses a new DB freeze baseline and is clean with no later edit", () => {
    const createAt = "2026-08-16T20:00:00.000Z";
    const firstFreeze = authoritativeFrozenAt(undefined, "2026-08-16T20:00:00.200Z");
    const editAt = "2026-08-16T20:00:00.500Z";
    const secondFreeze = authoritativeFrozenAt("2020-01-01T00:00:00.000Z", "2026-08-16T20:00:00.800Z");
    assert.equal(dirty(createAt, firstFreeze), false);
    assert.equal(dirty(editAt, firstFreeze), true);
    assert.equal(dirty(editAt, secondFreeze), false);
    assert.equal(
      deriveContractorProposalLifecycle({
        latestSentVersionId: IDS.v2,
        draftContentChangedAt: editAt,
        latestSentFrozenAt: secondFreeze,
      }).kind,
      "sent"
    );
    assert.deepEqual(classifyProposalAcceptanceGuard(r3cInput(editAt, secondFreeze)), {
      result: "valid_clean",
      reason: null,
    });
  });

  test("strict > remains; equal clocks are clean; pricingStale stays separate", () => {
    const t = "2026-08-16T20:00:00.000Z";
    assert.equal(dirty(t, t), false);
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: false,
        draftContentChangedAt: t,
        sentVersionFrozenAt: t,
        pricingStale: false,
      }),
      false
    );
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: false,
        draftContentChangedAt: t,
        sentVersionFrozenAt: t,
        pricingStale: true,
      }),
      true
    );
  });
});

describe("042 R3C approve-job behavior unchanged in SQL", () => {
  test("042 does not alter confirm/approve stage ownership", () => {
    assert.doesNotMatch(sql042, /transition_job_stage_v1/);
    assert.doesNotMatch(sql042, /jobs\.stage/);
    assert.match(sql040, /confirm_proposal_acceptance_v1/);
  });
});
