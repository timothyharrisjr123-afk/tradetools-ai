/**
 * R3C — Pure acceptance classifier.
 *
 * Live write ownership is classify_proposal_acceptance_guard_v1 in migration 040.
 * This mirror exists for tests and contractor copy. It does not move Job stage.
 * valid_clean and valid_review_required both record acceptance and create Attention.
 * Later-stage jobs (Approved/Scheduled/Production/Complete) classify as
 * valid_review_required / job_already_approved — never invalid merely because
 * the Job has progressed. Only explicit contractor Approve job may move
 * Proposal → Approved.
 */

import { isMutableDraftDirtyAfterSentFreeze } from "@/app/lib/proposalContractorLifecycle";
import {
  type ProposalAcceptanceGuardClassification,
  type ProposalAcceptanceGuardInput,
} from "@/app/lib/proposalAcceptanceTypes";

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function classifyProposalAcceptanceGuard(
  input: ProposalAcceptanceGuardInput
): ProposalAcceptanceGuardClassification {
  const versionKind = norm(input.versionKind).toLowerCase();
  const frozenAt = norm(input.frozenAt);
  const acceptedVersionId = norm(input.acceptedVersionId);
  const latestSentVersionId = norm(input.latestSentVersionId);
  const acceptedOptionId = norm(input.acceptedOptionId);
  const frozenSelectedOptionId = norm(input.frozenSelectedOptionId);
  const proposalId = norm(input.proposalId);
  const jobActiveProposalId = norm(input.jobActiveProposalId);
  const jobId = norm(input.jobId);
  const proposalJobId = norm(input.proposalJobId);
  const companyId = norm(input.companyId);
  const proposalCompanyId = norm(input.proposalCompanyId);
  const jobCompanyId = norm(input.jobCompanyId);
  const canonicalJobStage = norm(input.canonicalJobStage).toLowerCase();
  const disposition = norm(input.jobDisposition).toLowerCase();

  if (
    !companyId ||
    !proposalCompanyId ||
    !jobCompanyId ||
    companyId !== proposalCompanyId ||
    companyId !== jobCompanyId
  ) {
    return { result: "invalid", reason: "job_mismatch" };
  }

  if (!jobId || !proposalJobId || jobId !== proposalJobId) {
    return { result: "invalid", reason: "job_mismatch" };
  }

  if (versionKind === "draft" || versionKind === "current_draft") {
    return { result: "invalid", reason: "draft_version" };
  }

  if (
    (versionKind !== "sent" && versionKind !== "signed") ||
    !frozenAt ||
    !acceptedVersionId
  ) {
    return { result: "invalid", reason: "version_not_frozen" };
  }

  if (!frozenSelectedOptionId) {
    return { result: "invalid", reason: "option_not_on_version" };
  }

  if (!acceptedOptionId || acceptedOptionId !== frozenSelectedOptionId) {
    return { result: "invalid", reason: "option_not_selected_frozen" };
  }

  if (disposition === "lost") {
    return { result: "valid_review_required", reason: "lost" };
  }

  if (disposition === "closed") {
    return { result: "valid_review_required", reason: "closed" };
  }

  if (
    canonicalJobStage === "approved" ||
    canonicalJobStage === "scheduled" ||
    canonicalJobStage === "production" ||
    canonicalJobStage === "complete"
  ) {
    return { result: "valid_review_required", reason: "job_already_approved" };
  }

  if (disposition === "on_hold") {
    return { result: "valid_review_required", reason: "on_hold" };
  }

  if (canonicalJobStage !== "proposal") {
    return { result: "valid_review_required", reason: "job_not_in_proposal" };
  }

  if (!latestSentVersionId || acceptedVersionId !== latestSentVersionId) {
    return { result: "valid_review_required", reason: "older_sent_version" };
  }

  if (
    isMutableDraftDirtyAfterSentFreeze({
      draftContentChangedAt: input.draftContentChangedAt,
      latestSentFrozenAt: frozenAt,
    })
  ) {
    return { result: "valid_review_required", reason: "dirty_revision" };
  }

  if (!proposalId || jobActiveProposalId !== proposalId) {
    return { result: "valid_review_required", reason: "proposal_lineage_conflict" };
  }

  if (input.hasConflictingAcceptance === true) {
    return { result: "valid_review_required", reason: "conflicting_acceptance" };
  }

  if (disposition !== "active") {
    return { result: "valid_review_required", reason: "on_hold" };
  }

  return { result: "valid_clean", reason: null };
}
