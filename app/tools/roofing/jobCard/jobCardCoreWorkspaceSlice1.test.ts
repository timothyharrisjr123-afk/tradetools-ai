/**
 * Slice 1 — Core workspace + measurement capture.
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardCoreWorkspaceSlice1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildBoardProposalCreateHref } from "@/app/lib/boardGuardedMovement";
import {
  JOB_CARD_AWAITING_CONTRACTOR_APPROVAL,
  resolveJobCardOverviewForwardAction,
  resolveJobCardOverviewPrimaryAction,
} from "@/app/lib/jobCardForwardLifecycleAction";
import {
  buildManualMeasurementDraftFromFields,
  isManualMeasurementEstimateReady,
} from "@/app/lib/jobCardManualMeasurementDraft";
import {
  buildJobCardMeasurementListItem,
  resolveCanonicalJobMeasurement,
  textContainsMeasurementUuid,
  visibleMeasurementCopyHasNoUuid,
} from "@/app/lib/jobCardMeasurementPresentation";
import {
  filterJobCardWorkspaceAttentionItems,
} from "@/app/lib/jobCardWorkspaceAttention";
import type { JobAttentionSafeItem } from "@/app/lib/jobAttentionReadModel";
import type { CanonicalJobActionEligibility } from "@/app/lib/jobLifecycleActionEligibility";
import { resolveCanonicalJobActionEligibility } from "@/app/lib/jobLifecycleActionEligibility";
import {
  classifyKnownLifecycleFixture,
  PREFERRED_CANONICAL_VISUAL_FIXTURES,
} from "@/app/lib/jobLifecycleFixturePolicy";
import { validateProposalDraftCreatePayload } from "@/app/lib/proposalDraftEntry";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import {
  resolvePrepareProposalMeasurement,
  PREPARE_PROPOSAL_ADD_MEASUREMENT_LABEL,
  PREPARE_PROPOSAL_MEASUREMENT_REQUIRED,
  buildCreateProposalMeasurementChoice,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import {
  formatJobCardContractorProposalStatusLabel,
  JOB_CARD_PROPOSAL_STATUS_EXISTS,
} from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import JobCardOverviewSummary from "@/app/tools/roofing/jobCard/JobCardOverviewSummary";
import JobCardForwardLifecycleAction from "@/app/tools/roofing/jobCard/JobCardForwardLifecycleAction";
import JobCardQuietEmptyState from "@/app/tools/roofing/jobCard/JobCardQuietEmptyState";
import { deriveJobsBoardHeadline } from "@/app/tools/roofing/saved/jobsBoardUtils";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const JOB_CARD = read("app/tools/roofing/jobCard/JobCardClient.tsx");
const SECONDARY = read("app/tools/roofing/jobCard/JobCardSecondaryPanels.tsx");
const OVERVIEW = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");
const HEADER = read("app/tools/roofing/jobCard/JobCardHeader.tsx");
const BOARD_UTILS = read("app/tools/roofing/saved/jobsBoardUtils.ts");
const BOARD_CARD = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
const NEXT_ACTION = read("app/tools/roofing/jobCard/JobCardNextActionPanel.tsx");
const MODAL = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
const HOOK = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
const ACTIVITY = read(
  "app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx"
);

const MEASUREMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const OTHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";

function eligibility(
  partial: Partial<CanonicalJobActionEligibility>
): CanonicalJobActionEligibility {
  return {
    canApproveJob: false,
    canSchedule: false,
    canReschedule: false,
    canUnschedule: false,
    canStartWork: false,
    canCompleteJob: false,
    ...partial,
  };
}

function measurement(
  overrides: Partial<MeasurementRecord> = {}
): MeasurementRecord {
  return {
    id: MEASUREMENT_ID,
    company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
    status: "measured",
    is_selected: true,
    source_type: "manual",
    is_verified: false,
    roof_area_sqft: 2400,
    waste_percent: 10,
    pitch_label: "6/12",
    stories: "1",
    ...overrides,
  } as MeasurementRecord;
}

function attention(
  partial: Partial<JobAttentionSafeItem> &
    Pick<JobAttentionSafeItem, "id" | "attentionType">
): JobAttentionSafeItem {
  return {
    jobId: "22222222-2222-4222-8222-222222222222",
    proposalId: "33333333-3333-4333-8333-333333333333",
    proposalVersionId: "44444444-4444-4444-8444-444444444444",
    sourceType: "proposal_acceptances",
    sourceId: partial.id,
    status: "open",
    severity: "high",
    openedAt: "2026-08-01T00:00:00.000Z",
    acknowledgedAt: null,
    destination: {
      kind: "job_card_proposals",
      proposalId: "33333333-3333-4333-8333-333333333333",
      proposalVersionId: "44444444-4444-4444-8444-444444444444",
      requestId: null,
      acceptanceId: null,
      tab: "payments",
      anchor: "payments",
    },
    request: null,
    acceptance: null,
    personalReadAt: null,
    personalLastViewedAt: null,
    ...partial,
  };
}

describe("Create proposal enters Prepare", () => {
  test("JobCardClient Create proposal / + Proposal opens Prepare modal", () => {
    assert.match(JOB_CARD, /JobCardCreateProposalModal/);
    assert.match(JOB_CARD, /prepare\.openModal/);
    assert.match(JOB_CARD, /onAddProposal=\{prepare\.openModal\}/);
    assert.doesNotMatch(JOB_CARD, /onAddProposal=\{\(\) => setJobCardTab\("measurements"\)\}/);
    assert.doesNotMatch(
      JOB_CARD,
      /JobCardProposalsAddHeaderButton[\s\S]*setJobCardTab\("measurements"\)/
    );
  });

  test("Board Intake→Proposal href includes Prepare intent", () => {
    const href = buildBoardProposalCreateHref(
      "a9619d68-6d3f-43d2-8b07-7ed73ae87442"
    );
    assert.match(href, /tab=proposals/);
    assert.match(href, /prepare=1/);
    assert.match(JOB_CARD, /prepareRequested: prepareParam/);
    assert.match(HOOK, /openModal/);
  });
});

describe("Measurement → Prepare", () => {
  test("one eligible measurement auto-selects", () => {
    const only = buildCreateProposalMeasurementChoice({
      id: MEASUREMENT_ID,
      selectedLabel: "Saved manual",
      roofAreaSqft: 2400,
      wastePercent: 10,
      ready: true,
    });
    const field = resolvePrepareProposalMeasurement({
      eligible: [only],
      selectedId: null,
    });
    assert.equal(field.state, "prepared");
    assert.equal(field.preparedId, MEASUREMENT_ID);
  });

  test("multiple eligible measurements require a choice", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [
        buildCreateProposalMeasurementChoice({
          id: MEASUREMENT_ID,
          selectedLabel: "Saved manual",
          ready: true,
        }),
        buildCreateProposalMeasurementChoice({
          id: OTHER_ID,
          selectedLabel: "Saved manual",
          ready: true,
        }),
      ],
      selectedId: null,
    });
    assert.equal(field.state, "choice_required");
  });

  test("no measurement stays in Prepare with required copy", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [],
      selectedId: null,
    });
    assert.equal(field.state, "blocked");
    assert.equal(field.valueLabel, PREPARE_PROPOSAL_MEASUREMENT_REQUIRED);
    assert.equal(PREPARE_PROPOSAL_ADD_MEASUREMENT_LABEL, "Add measurement");
    assert.match(MODAL, /onAddMeasurement/);
    assert.match(MODAL, /data-jobcard-prepare-add-measurement/);
  });

  test("Add measurement from Prepare returns to Prepare", () => {
    assert.match(HOOK, /captureOrigin/);
    assert.match(HOOK, /CaptureOrigin = "tab" \| "prepare"/);
    assert.match(JOB_CARD, /data-jobcard-prepare-measurement-capture/);
    assert.match(JOB_CARD, /onAddMeasurement=\{\(\) => prepare\.openCapture\("prepare", "add"\)\}/);
    assert.doesNotMatch(HOOK, /setJobCardTab\("measurements"\)/);
  });
});

describe("Measurements tab", () => {
  test("current measurement and quantities have no UUID leakage", () => {
    const item = buildJobCardMeasurementListItem({
      record: measurement(),
      selectedId: MEASUREMENT_ID,
    });
    assert.equal(item.selected, true);
    assert.equal(item.name, "Manual measurement");
    assert.match(item.quantityLine, /2,400 sq ft/);
    assert.equal(visibleMeasurementCopyHasNoUuid(item), true);
    assert.equal(textContainsMeasurementUuid(item.name), false);
    assert.match(JOB_CARD, /JobCardMeasurementsWorkspace/);
    assert.doesNotMatch(
      read("app/tools/roofing/jobCard/JobCardMeasurementsWorkspace.tsx"),
      /\{jobId\}|Job \{/
    );
  });

  test("manual capture requires estimate-ready fields", () => {
    assert.equal(
      isManualMeasurementEstimateReady({
        roof_area_sqft: 2400,
        waste_percent: 10,
        pitch_label: "6/12",
        stories: "1",
      }),
      true
    );
    assert.equal(
      isManualMeasurementEstimateReady({
        roof_area_sqft: 2400,
        waste_percent: 10,
        pitch_label: "",
        stories: "1",
      }),
      false
    );
    const draft = buildManualMeasurementDraftFromFields({
      companyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      jobId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      fields: {
        roof_area_sqft: 2400,
        waste_percent: 10,
        pitch_label: "6/12",
        stories: "1",
      },
    });
    assert.equal(draft.source_type, "manual");
    assert.equal(draft.estimate_ready, true);
  });
});

describe("Overview lifecycle", () => {
  test("canonical presentation has no live stubs", () => {
    assert.doesNotMatch(OVERVIEW, /See Measurements/);
    assert.doesNotMatch(OVERVIEW, /Value/);
    assert.doesNotMatch(OVERVIEW, /Manual intake/);
    assert.doesNotMatch(OVERVIEW, /Open catalog setup/);
    assert.doesNotMatch(OVERVIEW, /Loads after schedule/);
    assert.doesNotMatch(HEADER, /Unassigned/);
    assert.doesNotMatch(HEADER, /Not entered/);
    assert.match(HEADER, /Back to Jobs/);
    assert.doesNotMatch(HEADER, /Back to Job Packet/);
    assert.doesNotMatch(JOB_CARD, /Measurements load after schedule/);
    const html = renderToStaticMarkup(
      createElement(JobCardOverviewSummary, {
        proposalLabel: "Accepted",
        measurementLabel: "2,400 sq ft · 10% waste",
        operationalStateLabel: JOB_CARD_AWAITING_CONTRACTOR_APPROVAL,
        paymentStatusLabel: "Deposit due",
      })
    );
    assert.match(html, /Accepted/);
    assert.match(html, /Awaiting contractor approval/);
    assert.match(html, /data-jobcard-overview-payment/);
    assert.doesNotMatch(html, /No report/);
  });

  test("one primary forward action per state", () => {
    assert.equal(
      resolveJobCardOverviewPrimaryAction(eligibility({ canApproveJob: true }))?.kind,
      "approve_job"
    );
    assert.equal(
      resolveJobCardOverviewPrimaryAction(eligibility({ canSchedule: true }))?.kind,
      "schedule"
    );
    assert.equal(
      resolveJobCardOverviewPrimaryAction(eligibility({ canStartWork: true }))?.kind,
      "start_work"
    );
    assert.equal(
      resolveJobCardOverviewPrimaryAction(eligibility({ canCompleteJob: true }))?.kind,
      "complete_job"
    );
    assert.equal(
      resolveJobCardOverviewForwardAction(eligibility({ canStartWork: true })),
      null
    );
    const html = renderToStaticMarkup(
      createElement(JobCardForwardLifecycleAction, {
        action: { kind: "approve_job", label: "Approve job" },
        onApproveJob: () => undefined,
      })
    );
    assert.match(html, /data-jobcard-overview-forward="approve_job"/);
    assert.equal((html.match(/Approve job/g) ?? []).length, 1);
    assert.match(JOB_CARD, /JobCardForwardLifecycleAction/);
    assert.match(JOB_CARD, /onStartWork/);
    assert.match(JOB_CARD, /data-jobcard-complete-job|onCompleteJob/);
  });
});

describe("Attention", () => {
  test("payment failed routes to Payments and setup nag is hidden", () => {
    const items = [
      attention({
        id: "11111111-1111-4111-8111-111111111111",
        attentionType: "payments_not_connected",
      }),
      attention({
        id: "55555555-5555-4555-8555-555555555555",
        attentionType: "payment_failed",
      }),
    ];
    const visible = filterJobCardWorkspaceAttentionItems(items, {
      overviewOwnsApprove: false,
    });
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.attentionType, "payment_failed");
    assert.match(NEXT_ACTION, /onReviewPayment/);
    assert.match(JOB_CARD, /onReviewPayment=\{\(\) => setJobCardTab\("payments"\)\}/);
  });

  test("acceptance Approve is owned by Overview, not Job Card Attention", () => {
    const items = [
      attention({
        id: "11111111-1111-4111-8111-111111111111",
        attentionType: "acceptance_confirmation_required",
        acceptance: {
          acceptanceId: "55555555-5555-4555-8555-555555555555",
          packageLabel: null,
          acceptedTotalCents: 1000,
          ambiguityReason: null,
          contractorReason: null,
          reviewRequired: false,
          attentionAction: "approve_job",
          acceptedAt: "2026-08-01T00:00:00.000Z",
          acceptedByName: null,
          acceptedByEmail: null,
        },
      }),
    ];
    const visible = filterJobCardWorkspaceAttentionItems(items, {
      overviewOwnsApprove: true,
    });
    assert.equal(visible.length, 0);
    assert.match(JOB_CARD, /overviewOwnsApprove: jobCardActionEligibility\.canApproveJob/);
  });
});

describe("Reserved domains and Board", () => {
  test("Tasks and Attachments stay visible with quiet empty states", () => {
    assert.match(SECONDARY, /quiet\("tasks"/);
    assert.match(SECONDARY, /quiet\("attachments"/);
    assert.match(SECONDARY, /No tasks yet/);
    assert.match(SECONDARY, /No files yet/);
    assert.doesNotMatch(SECONDARY, /Future surface|Coming Soon|roadmap/i);
    const html = renderToStaticMarkup(
      createElement(JobCardQuietEmptyState, {
        message: "No tasks yet.",
        testId: "tasks",
      })
    );
    assert.match(html, /No tasks yet/);
    assert.doesNotMatch(html, /Coming Soon|Future surface/);
  });

  test("Board Approved wording and no Tasks 0/0", () => {
    const approved = deriveJobsBoardHeadline(
      "approved",
      null,
      { label: "Proposal", tone: "proposal_draft" }
    );
    assert.equal(approved.headline, "Approved");
    assert.doesNotMatch(BOARD_UTILS, /if \(columnKey === "approved"\) return \{ headline: "Proposal signed"/);
    assert.match(BOARD_CARD, /model\.tasksLabel \?/);
    assert.doesNotMatch(BOARD_UTILS, /return "0\/0"/);
  });

  test("Activity remains payment-free", () => {
    assert.match(JOB_CARD, /skipPaymentEnrichment/);
    assert.match(ACTIVITY, /skipPaymentEnrichment \? \[\] : paymentItems/);
  });
});

describe("Truth consistency", () => {
  test("current proposal create requires a measurement record id", () => {
    const result = validateProposalDraftCreatePayload({
      customer_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      template_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      measurement_record_id: "",
      quantity_context: {
        measurementHandoff: {} as never,
        quantityMap: {} as never,
      },
    });
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.reason, "missing_measurement_record_id");
    }
    assert.match(HOOK, /createNewProposalDraftEntry/);
  });

  test("Approve requires accepted-proposal eligibility; Approved cannot self-mint Approve", () => {
    assert.equal(
      resolveCanonicalJobActionEligibility({
        stage: "proposal",
        dispositionActive: true,
        hasActivePlannedSchedule: false,
        approvalAcceptancePending: true,
      }).canApproveJob,
      true
    );
    assert.equal(
      resolveCanonicalJobActionEligibility({
        stage: "approved",
        dispositionActive: true,
        hasActivePlannedSchedule: false,
        approvalAcceptancePending: true,
      }).canApproveJob,
      false
    );
    assert.equal(
      resolveCanonicalJobActionEligibility({
        stage: "proposal",
        dispositionActive: true,
        hasActivePlannedSchedule: false,
        approvalAcceptancePending: false,
      }).canApproveJob,
      false
    );
    assert.match(JOB_CARD, /\/api\/jobs\/confirm-acceptance/);
  });

  test("measurement presenter uses selected authority and does not invent current", () => {
    const selected = measurement();
    const other = measurement({
      id: OTHER_ID,
      is_selected: false,
      roof_area_sqft: 900,
    });
    assert.equal(
      resolveCanonicalJobMeasurement({ records: [other, selected] })?.id,
      MEASUREMENT_ID
    );
    assert.equal(
      resolveCanonicalJobMeasurement({
        records: [other],
        selectedMeasurementId: OTHER_ID,
      })?.id,
      OTHER_ID
    );
    assert.equal(
      resolveCanonicalJobMeasurement({
        records: [other],
        selectedMeasurementId: null,
      }),
      null
    );
    assert.match(HOOK, /resolveCanonicalJobMeasurement/);
    assert.match(JOB_CARD, /selectedMeasurementId: hydratedJobRecord\?\.selected_measurement_id/);
  });

  test("sent lifecycle is not Sent proposal until acceptance facts are ready", () => {
    const sent = {
      id: MEASUREMENT_ID,
      job_id: OTHER_ID,
      status: "draft" as const,
      title: "Roof",
      proposal_number: null,
      latest_sent_version_id: OTHER_ID,
      signed_version_id: null,
      selected_option_id: null,
      template_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
      draft_content_changed_at: "2026-08-01T00:00:00.000Z",
    };
    const facts = {
      [MEASUREMENT_ID]: {
        latestSentFrozenAt: "2026-08-01T00:00:00.000Z",
        history: [],
      },
    };
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [sent],
        sentFactsByProposalId: facts,
        acceptedProposalIds: {},
        acceptanceFactsReady: false,
      }),
      JOB_CARD_PROPOSAL_STATUS_EXISTS
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [sent],
        sentFactsByProposalId: facts,
        acceptedProposalIds: { [MEASUREMENT_ID]: true },
        acceptanceFactsReady: true,
      }),
      "Accepted"
    );
    assert.match(JOB_CARD, /acceptanceFactsReady/);
  });

  test("R3G visual late-stage fixtures are classified and not mutated", () => {
    assert.equal(
      classifyKnownLifecycleFixture(PREFERRED_CANONICAL_VISUAL_FIXTURES.scheduled),
      "canonical"
    );
    const policy = read("app/lib/jobLifecycleFixturePolicy.ts");
    assert.match(policy, /no measurement_records row/);
    assert.doesNotMatch(JOB_CARD, /updateJob\([^)]*selected_measurement_id: null/);
  });
});
