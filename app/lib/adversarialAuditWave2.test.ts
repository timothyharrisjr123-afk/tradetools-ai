/**
 * Wave 2 — contractor API auth, server import hygiene, Preview ownership,
 * error/absence semantics, Board/Calendar a11y, historical stage aliases.
 *
 * Run: npx tsx --test app/lib/adversarialAuditWave2.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  contractorDeniedJson,
  mapContractorOwnedJob,
  mapContractorSession,
} from "./contractorCapabilityAuth";
import {
  applyIndependentReadFailure,
  applyIndependentReadSuccess,
  createIndependentRead,
  decidePreviewSurface,
  previewJobIdentityFallback,
  shouldApplyProposalContextResult,
} from "./proposalPreviewReadOwnership";
import {
  applyAttentionDetailFetchResult,
  applyCustomerRequestFetchFailure,
  applyPaymentEnrichmentFailure,
} from "./surfaceReadFailureSemantics";
import {
  assertCanonicalWriteStage,
  resolveCanonicalJobStage,
  resolveCanonicalJobStageLabel,
} from "./jobLifecycleMapper";
import {
  HISTORICAL_INTAKE_ALIAS_STAGES,
  isHistoricalIntakeAliasStage,
} from "./jobLifecycleTypes";
import { mapDbJobToBoardEstimate } from "./jobBoardAdapter";
import { getBoardStageLabelForJob } from "@/app/tools/roofing/saved/jobsBoardUtils";
import type { JobSummary } from "./jobTypes";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const EMAIL_SEND = read("app/api/email/send/route.ts");
const EMAIL_GENERATE = read("app/api/email/generate/route.ts");
const ESTIMATE_SEND = read("app/api/estimate/send/route.ts");
const PROPOSAL_GENERATE = read("app/api/proposal/generate/route.ts");
const EMAIL_FOLLOWUP = read("app/api/email/followup/route.ts");
const PREVIEW = read(
  "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx"
);
const BUILDER = read(
  "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
);
const CALENDAR = read(
  "app/tools/roofing/calendar/FieldDiveCalendarClient.tsx"
);
const BOARD_CARD = read(
  "app/tools/roofing/saved/components/JobsBoardCard.tsx"
);
const BOARD_LIST = read(
  "app/tools/roofing/saved/components/JobsBoardListView.tsx"
);
const ATTENTION_HOOK = read("app/lib/useJobAttention.ts");
const ACTIVITY = read(
  "app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx"
);
const ROOFING = read("app/tools/roofing/RoofingClient.tsx");
const MAPPER = read("app/lib/jobLifecycleMapper.ts");
const PERSISTENCE = read("app/lib/jobLifecyclePersistence.ts");
const PUBLIC_ACCEPT = read("app/api/proposals/accept/route.ts");
const PUBLIC_SIGN = read("app/api/proposals/sign/route.ts");
const STRIPE_WEBHOOK = read("app/api/webhooks/stripe/connect/route.ts");
const TRACK_OPEN = read("app/api/track/open/route.ts");
const PUBLIC_CHECKOUT = read(
  "app/api/public/payment-requests/checkout/route.ts"
);

const MUTATION_API_ROUTES = [
  "app/api/jobs/complete-work/route.ts",
  "app/api/jobs/start-work/route.ts",
  "app/api/jobs/schedule/route.ts",
  "app/api/jobs/reschedule/route.ts",
  "app/api/jobs/unschedule/route.ts",
  "app/api/jobs/confirm-acceptance/route.ts",
  "app/api/jobs/acknowledge-acceptance/route.ts",
  "app/api/jobs/attention/route.ts",
  "app/api/jobs/payment-requests/route.ts",
  "app/api/jobs/payment-requests/[id]/checkout/route.ts",
  "app/api/jobs/[jobId]/payment-requests/route.ts",
  "app/api/proposals/send/route.ts",
  "app/api/proposals/send-prep/route.ts",
  "app/api/proposals/public-review-link/route.ts",
] as const;

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB_A = "11111111-1111-4111-8111-111111111111";
const JOB_B = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_A = "33333333-3333-4333-8333-333333333333";
const PROPOSAL_B = "44444444-4444-4444-8444-444444444444";

function authBeforeCost(source: string, costNeedle: string) {
  const authIdx = source.indexOf("resolveContractorCompanySession");
  const costIdx = source.indexOf(costNeedle);
  assert.ok(authIdx >= 0, "missing contractor session gate");
  assert.ok(costIdx >= 0, `missing cost trigger ${costNeedle}`);
  assert.ok(authIdx < costIdx, "auth must run before cost-bearing work");
}

describe("contractor capability API auth", () => {
  test("unauthenticated maps to 401 and does not leak membership", () => {
    const denied = mapContractorSession({ userId: null, companyId: null });
    assert.equal(denied.ok, false);
    if (denied.ok) throw new Error("expected denial");
    assert.equal(denied.status, 401);
    assert.equal(denied.code, "unauthorized");
    const json = contractorDeniedJson(denied, "success");
    assert.equal(json.status, 401);
    assert.equal(json.body.code, "unauthorized");
    assert.equal(json.body.success, false);
  });

  test("authenticated non-member maps to 403", () => {
    const denied = mapContractorSession({
      userId: "user-1",
      companyId: null,
    });
    assert.equal(denied.ok, false);
    if (denied.ok) throw new Error("expected denial");
    assert.equal(denied.status, 403);
    assert.equal(denied.code, "forbidden");
  });

  test("valid member preserves session company from membership, not client input", () => {
    const ok = mapContractorSession({
      userId: "user-1",
      companyId: COMPANY_A,
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) throw new Error("expected member");
    assert.equal(ok.companyId, COMPANY_A);
    assert.equal(ok.userId, "user-1");
  });

  test("wrong-company job ownership collapses to not_found", () => {
    const missing = mapContractorOwnedJob({
      sessionCompanyId: COMPANY_A,
      resourceCompanyId: null,
    });
    const wrong = mapContractorOwnedJob({
      sessionCompanyId: COMPANY_A,
      resourceCompanyId: COMPANY_B,
    });
    const owned = mapContractorOwnedJob({
      sessionCompanyId: COMPANY_A,
      resourceCompanyId: COMPANY_A,
    });
    assert.equal(missing.ok, false);
    assert.equal(wrong.ok, false);
    if (missing.ok || wrong.ok) throw new Error("expected not_found");
    assert.equal(missing.status, 404);
    assert.equal(wrong.status, 404);
    assert.equal(missing.code, "not_found");
    assert.equal(wrong.code, "not_found");
    assert.equal(owned.ok, true);
  });

  test("legacy contractor endpoints gate session before Resend/OpenAI", () => {
    authBeforeCost(EMAIL_SEND, "new Resend");
    authBeforeCost(EMAIL_GENERATE, "new OpenAI");
    authBeforeCost(ESTIMATE_SEND, "new Resend");
    authBeforeCost(PROPOSAL_GENERATE, "openai.chat.completions.create");
    authBeforeCost(EMAIL_FOLLOWUP, "new Resend");
    assert.match(ESTIMATE_SEND, /resolveOwnedJobCompany/);
    assert.match(ESTIMATE_SEND, /contractorNotFoundJson/);
    assert.doesNotMatch(EMAIL_SEND, /body\.companyId|json\.companyId/);
    assert.doesNotMatch(ESTIMATE_SEND, /body\.companyId/);
  });

  test("public-by-design routes stay off contractor session auth", () => {
    for (const source of [
      PUBLIC_ACCEPT,
      PUBLIC_SIGN,
      STRIPE_WEBHOOK,
      TRACK_OPEN,
      PUBLIC_CHECKOUT,
    ]) {
      assert.doesNotMatch(source, /resolveContractorCompanySession/);
      assert.doesNotMatch(source, /contractorCapabilityAuth/);
    }
  });
});

describe("mutation API uuid import graph", () => {
  test("hot mutation APIs validate UUIDs without importing jobStore", () => {
    for (const rel of MUTATION_API_ROUTES) {
      const source = read(rel);
      assert.match(source, /from "@\/app\/lib\/uuid"/, rel);
      assert.doesNotMatch(source, /from "@\/app\/lib\/jobStore"/, rel);
    }
  });
});

describe("Preview independent read ownership", () => {
  test("catalog failure with valid proposal still renders proposal truth", () => {
    const job = applyIndependentReadSuccess({ id: JOB_A });
    const graph = applyIndependentReadSuccess({ id: PROPOSAL_A, total: 12345 });
    const catalog = applyIndependentReadFailure(
      createIndependentRead<unknown[]>(),
      "catalog down",
      true
    );
    const decision = decidePreviewSurface({ job, graph, catalog });
    assert.equal(decision.canRenderProposal, true);
    assert.equal(decision.overall, "ready");
    assert.equal(decision.blockingError, null);
    assert.match(decision.catalogError ?? "", /catalog down/);
  });

  test("graph failure is a proposal truth error, not an empty proposal", () => {
    const job = applyIndependentReadSuccess({ id: JOB_A });
    const graph = applyIndependentReadFailure(
      createIndependentRead(),
      "Could not load persisted proposal draft.",
      false
    );
    const catalog = applyIndependentReadSuccess([]);
    const decision = decidePreviewSurface({ job, graph, catalog });
    assert.equal(decision.canRenderProposal, false);
    assert.equal(decision.overall, "error");
    assert.match(decision.blockingError ?? "", /persisted proposal draft/);
    assert.equal(graph.value, null);
  });

  test("job enrichment failure does not fabricate default identity", () => {
    const job = applyIndependentReadFailure(
      createIndependentRead(),
      "job missing",
      false
    );
    const graph = applyIndependentReadSuccess({ id: PROPOSAL_A });
    const catalog = applyIndependentReadSuccess([]);
    const decision = decidePreviewSurface({ job, graph, catalog });
    assert.equal(decision.canRenderProposal, true);
    assert.equal(decision.jobIdentityMode, "unavailable");
    assert.equal(
      previewJobIdentityFallback(decision.jobIdentityMode),
      "Job identity unavailable"
    );
    assert.notEqual(
      previewJobIdentityFallback(decision.jobIdentityMode),
      "New roofing job"
    );
  });

  test("stale proposal A result is discarded after switching to B", () => {
    assert.equal(
      shouldApplyProposalContextResult({
        requestGeneration: 1,
        currentGeneration: 2,
        requestJobId: JOB_A,
        currentJobId: JOB_B,
        requestProposalId: PROPOSAL_A,
        currentProposalId: PROPOSAL_B,
      }),
      false
    );
    assert.equal(
      shouldApplyProposalContextResult({
        requestGeneration: 2,
        currentGeneration: 2,
        requestJobId: JOB_B,
        currentJobId: JOB_B,
        requestProposalId: PROPOSAL_B,
        currentProposalId: PROPOSAL_B,
      }),
      true
    );
  });

  test("slow catalog sibling does not block ready proposal truth", () => {
    const decision = decidePreviewSurface({
      job: applyIndependentReadSuccess({ id: JOB_A }),
      graph: applyIndependentReadSuccess({ id: PROPOSAL_A }),
      catalog: createIndependentRead(),
    });
    assert.equal(decision.canRenderProposal, true);
    assert.equal(decision.catalogError, null);
  });

  test("Preview client no longer Promise.all-couples job/graph/catalog", () => {
    assert.doesNotMatch(
      PREVIEW,
      /Promise\.all\(\[\s*getJobById[\s\S]*getDraftGraph[\s\S]*getActiveCatalogItemsByCompany/
    );
    assert.match(PREVIEW, /decidePreviewSurface/);
    assert.match(PREVIEW, /shouldApplyProposalContextResult/);
    assert.match(PREVIEW, /data-preview-catalog-error/);
    assert.match(BUILDER, /shouldApplyProposalContextResult/);
    assert.match(BUILDER, /draftLoadGenerationRef/);
  });
});

describe("error vs empty semantics", () => {
  test("Attention detail failure keeps last-known items and is not empty", () => {
    const previous = [{ id: "att-1" }];
    const applied = applyAttentionDetailFetchResult({
      previousItems: previous,
      previousSelectedId: "att-1",
      result: { ok: false, error: "network failed" },
    });
    assert.equal(applied.status, "error");
    assert.equal(applied.items.length, 1);
    assert.equal(applied.items[0]?.id, "att-1");
    assert.match(applied.error ?? "", /network failed/);
    const emptyOk = applyAttentionDetailFetchResult({
      previousItems: previous,
      previousSelectedId: "att-1",
      result: { ok: true, items: [], selectedAttentionId: null },
    });
    assert.equal(emptyOk.status, "ready-empty");
    assert.equal(emptyOk.items.length, 0);
    assert.match(ATTENTION_HOOK, /applyAttentionDetailFetchResult/);
    assert.doesNotMatch(
      ATTENTION_HOOK,
      /else \{\s*setItems\(\[\]\);\s*setSelectedAttentionId\(null\)/
    );
  });

  test("Activity payment failure keeps last-known payments", () => {
    const previous = [{ id: "pay-1", label: "Deposit requested" }];
    const applied = applyPaymentEnrichmentFailure({ previousItems: previous });
    assert.equal(applied.status, "error");
    assert.equal(applied.items.length, 1);
    assert.match(ACTIVITY, /applyPaymentEnrichmentFailure/);
    assert.match(ACTIVITY, /data-activity-payment-enrichment-error/);
    assert.doesNotMatch(
      ACTIVITY,
      /\.catch\(\(\) => \{\s*if \(!cancelled\) setPaymentItems\(\[\]\)/
    );
  });

  test("proposal customer request failure keeps last-known requests", () => {
    const applied = applyCustomerRequestFetchFailure({
      previousRequests: [{ id: "req-1" }],
      error: "timeout",
    });
    assert.equal(applied.requests.length, 1);
    assert.match(applied.error, /timeout/);
  });
});

describe("Calendar and Board nested interactive a11y", () => {
  test("Calendar day cell is not an interactive ancestor of event/+N more", () => {
    const monthBlock = CALENDAR.slice(
      CALENDAR.indexOf("visibleDays.map((iso) => {"),
      CALENDAR.indexOf("data-calendar-mobile-agenda")
    );
    assert.match(monthBlock, /data-calendar-month-day/);
    assert.match(monthBlock, /data-calendar-day-open/);
    assert.match(monthBlock, /data-calendar-day-overflow-count/);
    assert.match(monthBlock, /<button\s+key=\{event\.schedule\.id\}/);
    assert.doesNotMatch(monthBlock, /role="link"/);
    assert.doesNotMatch(
      monthBlock,
      /<button[\s\S]*key=\{iso\}[\s\S]*<button[\s\S]*overflowCount/
    );
  });

  test("Board card open target is separate from lifecycle action buttons", () => {
    assert.match(BOARD_CARD, /data-board-open-job/);
    assert.match(BOARD_CARD, /data-board-start-work/);
    assert.match(BOARD_CARD, /data-board-complete-job/);
    assert.doesNotMatch(BOARD_CARD, /role="button"/);
    assert.match(BOARD_LIST, /data-board-list-open-job/);
    assert.doesNotMatch(BOARD_LIST, /role="button"/);
  });
});

describe("historical measurement/estimating compatibility", () => {
  test("historical aliases display as Intake and are not writable", () => {
    assert.deepEqual([...HISTORICAL_INTAKE_ALIAS_STAGES], [
      "measurement",
      "estimating",
    ]);
    for (const alias of HISTORICAL_INTAKE_ALIAS_STAGES) {
      assert.equal(isHistoricalIntakeAliasStage(alias), true);
      assert.equal(resolveCanonicalJobStage({ stage: alias }), "intake");
      assert.equal(resolveCanonicalJobStageLabel({ stage: alias }), "Intake");
      assert.throws(() => assertCanonicalWriteStage(alias));
    }
    assert.match(MAPPER, /isHistoricalIntakeAliasStage/);
    assert.doesNotMatch(PERSISTENCE, /to_stage:\s*"measurement"/);
    assert.doesNotMatch(PERSISTENCE, /to_stage:\s*"estimating"/);
  });

  test("Board and Job Card labels cannot disagree for historical aliases", () => {
    for (const alias of HISTORICAL_INTAKE_ALIAS_STAGES) {
      const job: JobSummary = {
        id: JOB_A,
        company_id: COMPANY_A,
        customer_name: "Pat",
        job_name: "Roof",
        stage: alias,
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };
      const cardLabel = resolveCanonicalJobStageLabel(job);
      const board = mapDbJobToBoardEstimate(job);
      const boardLabel = getBoardStageLabelForJob(board);
      assert.equal(cardLabel, "Intake");
      assert.equal(boardLabel, "Intake");
    }
  });
});

describe("Work Orders placeholder truth", () => {
  test("Work Orders schedule line does not assert canonical job_schedules", () => {
    const workOrders = ROOFING.slice(
      ROOFING.indexOf('tabId="work_orders"'),
      ROOFING.indexOf('tabId="invoices"')
    );
    assert.match(workOrders, /Not created/);
    assert.doesNotMatch(workOrders, /Not scheduled/);
  });
});

describe("locked migrations remain untouched", () => {
  test("039 reserved, 047 historical SHA unchanged, 048 absent", () => {
    assert.equal(
      existsSync(join(ROOT, "supabase/migrations/20260816_039_reserved.sql")),
      false
    );
    const sql047 = join(ROOT, "supabase/migrations/20260823_047_job_work_complete.sql");
    assert.equal(existsSync(sql047), true);
    const sha = createHash("sha256")
      .update(readFileSync(sql047))
      .digest("hex")
      .toUpperCase();
    assert.equal(
      sha,
      "FFE33FDD562742519BB92568CD5C55528537EA756540D1C6C906F8694B974979"
    );
    assert.equal(
      existsSync(
        join(ROOT, "supabase/migrations/20260824_048_job_work_reopen.sql")
      ),
      false
    );
  });
});
