/**
 * Phase 1 — Agreement truth projection tests.
 *
 * Run: npx tsx --test app/lib/proposalAgreementProjection.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { classifyProposalAcceptanceGuard } from "@/app/lib/proposalAcceptanceClassifier";
import {
  AGREEMENT_BOARD_ACCEPTED_AWAITING_LABEL,
  AGREEMENT_JOB_CARD_ACCEPTED_HEADING,
  AGREEMENT_JOB_CARD_AWAITING_APPROVAL,
  AGREEMENT_PUBLIC_ACCEPT_NEXT,
  AGREEMENT_PUBLIC_ACCEPT_RECORDED,
  formatCustomerWorkspaceStageWithAgreement,
  isHistoricalValidReviewRequiredAcceptance,
  projectProposalAgreement,
  resolveBoardAgreementAttentionLabel,
} from "@/app/lib/proposalAgreementProjection";

const IDS = {
  sent: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  older: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  acceptance: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  signature: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  option: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  proposal: "ffffffff-ffff-4fff-8fff-ffffffffffff",
};

function baseAcceptance(
  overrides: Partial<{
    guardResult: "valid_clean" | "valid_review_required";
    ambiguityReason: string | null;
    confirmedAt: string | null;
    proposalVersionId: string;
  }> = {}
) {
  return {
    id: IDS.acceptance,
    proposalId: IDS.proposal,
    proposalVersionId: overrides.proposalVersionId ?? IDS.sent,
    optionLabel: "Complete",
    acceptedTotalCents: 1250000,
    acceptedAt: "2026-09-20T12:00:00.000Z",
    guardResult: overrides.guardResult ?? ("valid_clean" as const),
    ambiguityReason: overrides.ambiguityReason ?? null,
    confirmedAt: overrides.confirmedAt ?? null,
  };
}

describe("Phase 1 agreement projection", () => {
  test("1 draft never sent", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
    });
    assert.equal(p.previewChromeKind, "never_sent");
    assert.equal(p.previewStatusLabel, "Draft · Not sent");
    assert.equal(p.suppressOrdinarySend, false);
    assert.equal(p.surfaceMode, "none");
  });

  test("2/3/4 sent waiting customer (pending/delivered chrome shared)", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 2,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
    });
    assert.equal(p.previewChromeKind, "current_sent");
    assert.equal(p.previewStatusLabel, "Sent proposal · Version 2");
    assert.equal(p.surfaceMode, "sent_waiting");
    assert.equal(p.suppressOrdinarySend, false);
  });

  test("5 customer accepted unsigned is approval-eligible", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 3,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance(),
    });
    assert.equal(p.surfaceMode, "accepted_awaiting_approval");
    assert.equal(p.approvalEligible, true);
    assert.equal(p.jobCardShowApprove, true);
    assert.equal(p.jobCardTreatment, "normal");
    assert.equal(p.jobCardHeading, AGREEMENT_JOB_CARD_ACCEPTED_HEADING);
    assert.equal(p.jobCardSupporting, AGREEMENT_JOB_CARD_AWAITING_APPROVAL);
    assert.equal(p.boardAttentionLabel, AGREEMENT_BOARD_ACCEPTED_AWAITING_LABEL);
    assert.equal(p.previewChromeKind, "accepted");
    assert.equal(p.previewStatusLabel, "Accepted proposal · Version 3");
    assert.equal(p.suppressOrdinarySend, true);
    assert.equal(p.signed, false);
  });

  test("6 absence of signature does not fabricate signature-required blocker", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 1,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance(),
    });
    assert.equal(p.approvalEligible, true);
    assert.doesNotMatch(p.jobCardSupporting ?? "", /Signature required/i);
    assert.equal(p.signed, false);
  });

  test("7 accepted + signed remains approval-eligible and shows Signed support", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 4,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance(),
      signature: {
        id: IDS.signature,
        acceptanceId: IDS.acceptance,
        proposalId: IDS.proposal,
        signedAt: "2026-09-20T13:00:00.000Z",
      },
    });
    assert.equal(p.signed, true);
    assert.equal(p.approvalEligible, true);
    assert.equal(p.surfaceMode, "accepted_signed_awaiting_approval");
    assert.equal(p.jobCardTreatment, "signed_support");
    assert.match(p.jobCardSupporting ?? "", /Signed/);
    assert.equal(p.previewChromeKind, "signed");
    assert.equal(p.previewStatusLabel, "Signed proposal · Version 4");
  });

  test("8 contractor approved clears Approve", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "approved",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 3,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance({
        confirmedAt: "2026-09-20T14:00:00.000Z",
      }),
    });
    assert.equal(p.surfaceMode, "approved");
    assert.equal(p.approvalEligible, false);
    assert.equal(p.jobCardShowApprove, false);
    assert.equal(p.eligibility.canSchedule, true);
  });

  test("9 approved + unscheduled can schedule", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "approved",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      acceptance: baseAcceptance({ confirmedAt: "2026-09-20T14:00:00.000Z" }),
    });
    assert.equal(p.eligibility.canSchedule, true);
    assert.equal(p.eligibility.canApproveJob, false);
  });

  test("11 superseded unaccepted version chrome", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 5,
      viewingVersionId: IDS.older,
      viewingVersionNumber: 4,
    });
    assert.equal(p.previewChromeKind, "superseded_previous");
    assert.match(p.previewStatusLabel, /Previous version · Replaced by Version 5/);
    assert.equal(p.suppressOrdinarySend, true);
  });

  test("12 new draft after sent version", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 2,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      draftContentChangedAt: "2026-09-20T10:00:00.000Z",
    });
    assert.equal(p.previewChromeKind, "editing_revision");
    assert.match(p.previewStatusLabel, /Editing revision · Last sent: Version 2/);
  });

  test("17 superseded-version acceptance rejected by classifier", () => {
    assert.deepEqual(
      classifyProposalAcceptanceGuard({
        versionKind: "sent",
        frozenAt: "2026-09-19T12:00:00.000Z",
        acceptedVersionId: IDS.older,
        latestSentVersionId: IDS.sent,
        acceptedOptionId: IDS.option,
        frozenSelectedOptionId: IDS.option,
        proposalId: IDS.proposal,
        jobActiveProposalId: IDS.proposal,
        jobId: "11111111-1111-4111-8111-111111111111",
        proposalJobId: "11111111-1111-4111-8111-111111111111",
        companyId: "22222222-2222-4222-8222-222222222222",
        proposalCompanyId: "22222222-2222-4222-8222-222222222222",
        jobCompanyId: "22222222-2222-4222-8222-222222222222",
        draftContentChangedAt: null,
        canonicalJobStage: "proposal",
        jobDisposition: "active",
      }),
      { result: "invalid", reason: "superseded" }
    );
  });

  test("20 Intake × accepted anomaly is reconciliation, not Approve", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "intake",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 1,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance({
        guardResult: "valid_review_required",
        ambiguityReason: "job_not_in_proposal",
      }),
    });
    assert.equal(p.surfaceMode, "reconciliation_required");
    assert.equal(p.jobCardTreatment, "warning");
    assert.equal(p.jobCardShowApprove, false);
    assert.equal(p.approvalEligible, false);
  });

  test("21 Preview Send suppressed after acceptance", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 1,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance(),
    });
    assert.equal(p.suppressOrdinarySend, true);
  });

  test("22 Board accepted wording", () => {
    assert.equal(
      resolveBoardAgreementAttentionLabel({
        primaryType: "acceptance_confirmation_required",
        attentionAction: "approve_job",
        reviewRequired: false,
        canonicalJobStage: "proposal",
      }),
      AGREEMENT_BOARD_ACCEPTED_AWAITING_LABEL
    );
  });

  test("23 Customer workspace accepted projection", () => {
    assert.equal(
      formatCustomerWorkspaceStageWithAgreement({
        stageLabel: "Proposal",
        accepted: true,
      }),
      "Proposal · Customer accepted"
    );
    assert.equal(
      formatCustomerWorkspaceStageWithAgreement({
        stageLabel: "Proposal",
        accepted: true,
        signed: true,
      }),
      "Proposal · Customer accepted · Signed"
    );
  });

  test("24/25 signature never blocks or invents Approve gate", () => {
    const unsigned = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance(),
    });
    const signed = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance(),
      signature: {
        id: IDS.signature,
        acceptanceId: IDS.acceptance,
        signedAt: "2026-09-20T13:00:00.000Z",
      },
    });
    assert.equal(unsigned.approvalEligible, true);
    assert.equal(signed.approvalEligible, true);
  });

  test("26 historical valid_review_required not promoted", () => {
    assert.equal(
      isHistoricalValidReviewRequiredAcceptance({
        guardResult: "valid_review_required",
        ambiguityReason: "older_sent_version",
      }),
      true
    );
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      latestSentVersionNumber: 6,
      latestSentFrozenAt: "2026-09-19T12:00:00.000Z",
      acceptance: baseAcceptance({
        guardResult: "valid_review_required",
        ambiguityReason: "older_sent_version",
        proposalVersionId: IDS.older,
      }),
      classifyHistoricalOnly: true,
    });
    assert.equal(p.surfaceMode, "historical_review_required");
    assert.equal(p.jobCardShowApprove, false);
    assert.equal(p.approvalEligible, false);
  });

  test("public post-acceptance copy", () => {
    const p = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "active",
      latestSentVersionId: IDS.sent,
      acceptance: baseAcceptance(),
    });
    assert.equal(p.publicAcceptedTitle, AGREEMENT_PUBLIC_ACCEPT_RECORDED);
    assert.equal(p.publicAcceptedNext, AGREEMENT_PUBLIC_ACCEPT_NEXT);
  });

  test("unauthorized stage / disposition blocks Approve", () => {
    const lost = projectProposalAgreement({
      canonicalJobStage: "proposal",
      jobDisposition: "lost",
      latestSentVersionId: IDS.sent,
      acceptance: baseAcceptance(),
    });
    assert.equal(lost.approvalEligible, false);
  });
});
