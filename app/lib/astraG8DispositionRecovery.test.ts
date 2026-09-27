/**
 * Phase 9 / Astra G8 — disposition recovery capability + primary CTA + Board.
 * Run: npx tsx --test app/lib/astraG8DispositionRecovery.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  capabilitiesForRole,
  hasCompanyCapability,
} from "./companyMembershipRoles";
import {
  capabilityForDispositionTransition,
  dispositionActionNeedsCapability,
} from "./jobDispositionAuthority";
import {
  buildCloseCommitmentWarningFacts,
  compactDispositionBadgeLabel,
  filterDispositionActionsByCapability,
  isProductionClosedReopenAndCompletePath,
  resolveDispositionManagementActions,
  visibleDispositionLabel,
  dispositionBlockedWorkCopy,
} from "./jobDispositionManagement";
import { resolveJobCardOverviewPrimaryAction } from "./jobCardForwardLifecycleAction";
import { resolveCanonicalJobActionEligibilityFromFacts } from "./jobLifecycleActionEligibility";
import type { CanonicalJobStage } from "./jobLifecycleTypes";
import {
  applyBoardDispositionFilter,
  BOARD_DEFAULT_DISPOSITION_FILTER,
  BOARD_DISPOSITION_FILTER_OPTIONS,
  isBoardDispositionFilter,
} from "@/app/tools/roofing/saved/jobsBoardUtils";
import { DB_BOARD_JOB_ID_PREFIX } from "./jobBoardAdapter";
import type { RoofingEstimate } from "./estimateStore";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const planned = {
  kind: "work" as const,
  status: "scheduled" as const,
};

function eligibility(
  stage: CanonicalJobStage,
  disposition: string,
  opts?: { approvalPending?: boolean; schedule?: typeof planned | null }
) {
  return resolveCanonicalJobActionEligibilityFromFacts({
    stage,
    disposition,
    schedule: opts?.schedule === null ? null : opts?.schedule ?? planned,
    approvalAcceptancePending: opts?.approvalPending ?? false,
  });
}

describe("Astra G8 capability model", () => {
  test("Field User denied all disposition mutation caps", () => {
    assert.equal(hasCompanyCapability("field_user", "job_pause_resume"), false);
    assert.equal(
      hasCompanyCapability("field_user", "job_disposition_finalize"),
      false
    );
  });

  test("Production Lead never holds finalize (interim: no capabilities until Phase C)", () => {
    const caps = capabilitiesForRole("production_lead");
    assert.equal(caps.has("job_disposition_finalize"), false);
    assert.equal(caps.size, 0);
  });

  test("Owner: pause + finalize; non-Owner roles hold neither until Phase C", () => {
    assert.equal(hasCompanyCapability("owner", "job_pause_resume"), true);
    assert.equal(hasCompanyCapability("owner", "job_disposition_finalize"), true);
    for (const role of ["office_sales", "admin"] as const) {
      assert.equal(hasCompanyCapability(role, "job_pause_resume"), false, role);
      assert.equal(
        hasCompanyCapability(role, "job_disposition_finalize"),
        false,
        role
      );
    }
  });

  test("transition capability mapping", () => {
    assert.equal(
      capabilityForDispositionTransition("active", "on_hold"),
      "job_pause_resume"
    );
    assert.equal(
      capabilityForDispositionTransition("on_hold", "active"),
      "job_pause_resume"
    );
    assert.equal(
      capabilityForDispositionTransition("active", "lost"),
      "job_disposition_finalize"
    );
    assert.equal(
      capabilityForDispositionTransition("on_hold", "closed"),
      "job_disposition_finalize"
    );
    assert.equal(
      capabilityForDispositionTransition("lost", "active"),
      "job_disposition_finalize"
    );
    assert.equal(
      capabilityForDispositionTransition("closed", "active"),
      "job_disposition_finalize"
    );
  });

  test("change-disposition route enforces requireCapabilitySession", () => {
    const route = read("app/api/jobs/change-disposition/route.ts");
    assert.match(route, /requireCapabilitySession/);
    assert.match(route, /capabilityForDispositionTransition/);
    assert.match(route, /job_pause_resume|requiredCapability/);
    assert.doesNotMatch(route, /from\("jobs"\)[\s\S]*\.update\(/);
  });
});

describe("Astra G8 disposition wording + menu", () => {
  test("user-facing labels", () => {
    assert.equal(visibleDispositionLabel("on_hold"), "On hold");
    assert.equal(
      visibleDispositionLabel("on_hold", "Waiting on materials"),
      "On hold · Waiting on materials"
    );
    assert.equal(visibleDispositionLabel("lost"), "Not proceeding");
    assert.equal(visibleDispositionLabel("closed"), "Closed to active work");
    assert.equal(compactDispositionBadgeLabel("lost"), "Not proceeding");
    assert.equal(compactDispositionBadgeLabel("closed"), "Closed");
  });

  test("active menu: hold/lost/close; on_hold secondary only; recovery omitted", () => {
    const active = resolveDispositionManagementActions("active");
    assert.deepEqual(
      active.map((a) => a.kind),
      ["hold", "lost", "close"]
    );
    const held = resolveDispositionManagementActions("on_hold");
    assert.deepEqual(
      held.map((a) => a.kind),
      ["lost", "close"]
    );
    assert.deepEqual(resolveDispositionManagementActions("lost"), []);
    assert.deepEqual(resolveDispositionManagementActions("closed"), []);
  });

  test("capability filters menu actions", () => {
    const active = resolveDispositionManagementActions("active");
    const leadOnly = filterDispositionActionsByCapability(active, {
      pauseResume: true,
      finalize: false,
    });
    assert.deepEqual(
      leadOnly.map((a) => a.kind),
      ["hold"]
    );
    const field = filterDispositionActionsByCapability(active, {
      pauseResume: false,
      finalize: false,
    });
    assert.deepEqual(field, []);
    assert.equal(
      dispositionActionNeedsCapability("reopen", {
        pauseResume: false,
        finalize: true,
      }),
      true
    );
  });

  test("blocked copy uses Resume/Reopen", () => {
    assert.match(String(dispositionBlockedWorkCopy("on_hold")), /Resume/);
    assert.match(String(dispositionBlockedWorkCopy("lost")), /Reopen/);
    assert.match(String(dispositionBlockedWorkCopy("closed")), /Reopen/);
  });
});

describe("Astra G8 primary CTA priority", () => {
  test("on_hold → Resume job beats lifecycle", () => {
    const action = resolveJobCardOverviewPrimaryAction(
      eligibility("approved", "on_hold", { approvalPending: false }),
      {
        disposition: "on_hold",
        stage: "approved",
        canPauseResume: true,
        canFinalizeDisposition: true,
      }
    );
    assert.equal(action?.kind, "resume_job");
    assert.equal(action?.label, "Resume job");
  });

  test("lost → Reopen job", () => {
    const action = resolveJobCardOverviewPrimaryAction(
      eligibility("proposal", "lost"),
      {
        disposition: "lost",
        stage: "proposal",
        canFinalizeDisposition: true,
      }
    );
    assert.equal(action?.kind, "reopen_job");
  });

  test("closed + production + complete-eligible → Reopen and complete", () => {
    const action = resolveJobCardOverviewPrimaryAction(
      eligibility("production", "closed"),
      {
        disposition: "closed",
        stage: "production",
        canFinalizeDisposition: true,
        canCompleteIfActive: true,
      }
    );
    assert.equal(action?.kind, "reopen_and_complete");
    assert.equal(action?.label, "Reopen and complete");
  });

  test("closed + production without complete path → Reopen job", () => {
    const action = resolveJobCardOverviewPrimaryAction(
      eligibility("production", "closed", { schedule: null }),
      {
        disposition: "closed",
        stage: "production",
        canFinalizeDisposition: true,
        canCompleteIfActive: false,
      }
    );
    assert.equal(action?.kind, "reopen_job");
  });

  test("closed + complete stage → Reopen job (not stage reopen)", () => {
    const action = resolveJobCardOverviewPrimaryAction(
      eligibility("complete", "closed"),
      {
        disposition: "closed",
        stage: "complete",
        canFinalizeDisposition: true,
        canCompleteIfActive: false,
      }
    );
    assert.equal(action?.kind, "reopen_job");
    assert.notEqual(action?.kind, "reopen_and_complete");
  });

  test("active uses Phase 8 lifecycle CTA", () => {
    assert.equal(
      resolveJobCardOverviewPrimaryAction(
        eligibility("approved", "active", { schedule: null }),
        { disposition: "active", stage: "approved" }
      )?.kind,
      "schedule"
    );
    assert.equal(
      resolveJobCardOverviewPrimaryAction(
        eligibility("production", "active"),
        { disposition: "active", stage: "production" }
      )?.kind,
      "complete_job"
    );
  });

  test("field user on hold has no primary recovery", () => {
    assert.equal(
      resolveJobCardOverviewPrimaryAction(
        eligibility("scheduled", "on_hold"),
        {
          disposition: "on_hold",
          stage: "scheduled",
          canPauseResume: false,
          canFinalizeDisposition: false,
        }
      ),
      null
    );
  });
});

describe("Astra G8 Production+Closed path helper + close warning", () => {
  test("isProductionClosedReopenAndCompletePath", () => {
    assert.equal(
      isProductionClosedReopenAndCompletePath({
        stage: "production",
        disposition: "closed",
        canCompleteIfActive: true,
      }),
      true
    );
    assert.equal(
      isProductionClosedReopenAndCompletePath({
        stage: "complete",
        disposition: "closed",
        canCompleteIfActive: true,
      }),
      false
    );
  });

  test("close commitment facts omit unknown $0", () => {
    const empty = buildCloseCommitmentWarningFacts({
      hasAcceptedAgreement: false,
      collectibleRemainingCents: null,
    });
    assert.deepEqual(empty, []);
    const withAgreement = buildCloseCommitmentWarningFacts({
      hasAcceptedAgreement: true,
      collectibleRemainingCents: 0,
    });
    assert.equal(withAgreement.length, 1);
    assert.match(withAgreement[0]!.text, /accepted agreement/i);
    const withBalance = buildCloseCommitmentWarningFacts({
      hasAcceptedAgreement: true,
      collectibleRemainingCents: 15000,
    });
    assert.equal(withBalance.length, 2);
    assert.match(withBalance[1]!.text, /\$150/);
  });

  test("JobCardClient composes reopen then complete without rollback", () => {
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(client, /reopenAndCompleteJob/);
    assert.match(client, /changeDispositionToActive/);
    assert.match(client, /complete-work/);
    assert.match(client, /do not roll back reopen|Partial-success/i);
    assert.doesNotMatch(client, /toStatus:\s*"closed"[\s\S]{0,80}roll ?back/i);
  });
});

describe("Astra G8 Board default Active + On hold", () => {
  test("default filter is active_work", () => {
    assert.equal(BOARD_DEFAULT_DISPOSITION_FILTER, "active_work");
    assert.equal(isBoardDispositionFilter("active_work"), true);
    assert.ok(
      BOARD_DISPOSITION_FILTER_OPTIONS.some((o) => o.id === "active_work")
    );
  });

  test("active_work includes active + on_hold; excludes lost/closed", () => {
    const mk = (
      id: string,
      disposition: string
    ): RoofingEstimate =>
      ({
        id: `${DB_BOARD_JOB_ID_PREFIX}${id}`,
        jobDisposition: disposition,
      }) as unknown as RoofingEstimate;
    const jobs = [
      mk("a", "active"),
      mk("b", "on_hold"),
      mk("c", "lost"),
      mk("d", "closed"),
    ];
    const filtered = applyBoardDispositionFilter(jobs, "active_work");
    assert.deepEqual(
      filtered.map((j) => (j as { jobDisposition: string }).jobDisposition),
      ["active", "on_hold"]
    );
    const lostOnly = applyBoardDispositionFilter(jobs, "lost");
    assert.equal(lostOnly.length, 1);
  });
});

describe("Astra G8 stage × disposition matrix (representative)", () => {
  const cases: Array<{
    stage: CanonicalJobStage;
    disposition: string;
    primary: string | null;
    lifecycleBlocked: boolean;
  }> = [
    { stage: "proposal", disposition: "active", primary: "approve_job", lifecycleBlocked: false },
    { stage: "approved", disposition: "active", primary: "schedule", lifecycleBlocked: false },
    { stage: "scheduled", disposition: "active", primary: "start_work", lifecycleBlocked: false },
    { stage: "production", disposition: "active", primary: "complete_job", lifecycleBlocked: false },
    { stage: "complete", disposition: "active", primary: null, lifecycleBlocked: false },
    { stage: "approved", disposition: "on_hold", primary: "resume_job", lifecycleBlocked: true },
    { stage: "scheduled", disposition: "on_hold", primary: "resume_job", lifecycleBlocked: true },
    { stage: "production", disposition: "on_hold", primary: "resume_job", lifecycleBlocked: true },
    { stage: "proposal", disposition: "lost", primary: "reopen_job", lifecycleBlocked: true },
    { stage: "approved", disposition: "lost", primary: "reopen_job", lifecycleBlocked: true },
    { stage: "production", disposition: "lost", primary: "reopen_job", lifecycleBlocked: true },
    { stage: "approved", disposition: "closed", primary: "reopen_job", lifecycleBlocked: true },
    {
      stage: "production",
      disposition: "closed",
      primary: "reopen_and_complete",
      lifecycleBlocked: true,
    },
    { stage: "complete", disposition: "closed", primary: "reopen_job", lifecycleBlocked: true },
  ];

  for (const row of cases) {
    test(`${row.stage} + ${row.disposition}`, () => {
      const elig = eligibility(row.stage, row.disposition, {
        approvalPending: row.stage === "proposal",
        schedule:
          row.stage === "proposal" || row.stage === "approved"
            ? null
            : planned,
      });
      if (row.lifecycleBlocked) {
        assert.equal(elig.canApproveJob, false);
        assert.equal(elig.canSchedule, false);
        assert.equal(elig.canStartWork, false);
        assert.equal(elig.canCompleteJob, false);
      }
      const canCompleteIfActive =
        row.disposition === "closed" && row.stage === "production"
          ? eligibility("production", "active").canCompleteJob
          : false;
      const primary = resolveJobCardOverviewPrimaryAction(elig, {
        disposition: row.disposition,
        stage: row.stage,
        canPauseResume: true,
        canFinalizeDisposition: true,
        canCompleteIfActive,
      });
      assert.equal(primary?.kind ?? null, row.primary, JSON.stringify(row));
    });
  }
});

describe("Astra G8 no Complete-stage reopen / no migration / no ACL builder", () => {
  test("no Complete reopen language in recovery helpers", () => {
    const fwd = read("app/lib/jobCardForwardLifecycleAction.ts");
    assert.doesNotMatch(fwd, /reopen.?complete.?stage|stage.?reopen/i);
    assert.match(fwd, /reopen_and_complete/);
  });

  test("roles stay bounded presets", () => {
    const roles = read("app/lib/companyMembershipRoles.ts");
    assert.doesNotMatch(roles, /permission.?builder|custom.?acl/i);
    assert.match(roles, /job_pause_resume/);
    assert.match(roles, /job_disposition_finalize/);
  });
});
