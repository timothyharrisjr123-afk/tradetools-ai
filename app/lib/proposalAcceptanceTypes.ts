/**
 * R3C — Formal customer acceptance contracts.
 *
 * Request ≠ acceptance ≠ signature ≠ payment ≠ scheduling.
 * Acceptance binds to one frozen sent version and that version's selected package.
 * Customer acceptance never moves Job stage. Contractor Approve job does.
 */

export const RECORD_PROPOSAL_ACCEPTANCE_RPC_V1 = "record_proposal_acceptance_v1";
export const CONFIRM_PROPOSAL_ACCEPTANCE_RPC_V1 =
  "confirm_proposal_acceptance_v1";
export const ACKNOWLEDGE_PROPOSAL_ACCEPTANCE_ATTENTION_RPC_V1 =
  "acknowledge_proposal_acceptance_attention_v1";
export const CLASSIFY_PROPOSAL_ACCEPTANCE_GUARD_RPC_V1 =
  "classify_proposal_acceptance_guard_v1";

export const PROPOSAL_ACCEPTANCE_SOURCES = ["public_token"] as const;
export type ProposalAcceptanceSource =
  (typeof PROPOSAL_ACCEPTANCE_SOURCES)[number];

export const PROPOSAL_ACCEPTANCE_METHODS = ["formal_accept"] as const;
export type ProposalAcceptanceMethod =
  (typeof PROPOSAL_ACCEPTANCE_METHODS)[number];

export const PROPOSAL_ACCEPTANCE_GUARD_RESULTS = [
  "valid_clean",
  "valid_review_required",
  "invalid",
] as const;

export type ProposalAcceptanceGuardResult =
  (typeof PROPOSAL_ACCEPTANCE_GUARD_RESULTS)[number];

export const PROPOSAL_ACCEPTANCE_AMBIGUITY_REASONS = [
  "older_sent_version",
  "dirty_revision",
  "proposal_lineage_conflict",
  "version_pointer_conflict",
  "on_hold",
  "lost",
  "closed",
  "conflicting_acceptance",
  "job_not_in_proposal",
  "job_already_approved",
] as const;

export type ProposalAcceptanceAmbiguityReason =
  (typeof PROPOSAL_ACCEPTANCE_AMBIGUITY_REASONS)[number];

export const PROPOSAL_ACCEPTANCE_INVALID_REASONS = [
  "invalid_hash",
  "not_found",
  "revoked",
  "superseded",
  "expired",
  "invalid_version",
  "invalid_binding",
  "proposal_unavailable",
  "version_not_frozen",
  "option_not_on_version",
  "option_not_selected_frozen",
  "job_mismatch",
  "draft_version",
  "malformed",
  "invalid_payload",
  "forbidden_payload_keys",
  "invalid_customer_name",
  "invalid_customer_email",
  "idempotency_conflict",
] as const;

export type ProposalAcceptanceInvalidReason =
  (typeof PROPOSAL_ACCEPTANCE_INVALID_REASONS)[number];

export const PROPOSAL_ACCEPTANCE_ATTENTION_TYPE =
  "acceptance_confirmation_required" as const;

export const PROPOSAL_ACCEPTANCE_ATTENTION_SOURCE_TYPE =
  "proposal_acceptances" as const;

export const PROPOSAL_ACCEPTANCE_ATTENTION_ANCHOR =
  "acceptance_confirmation" as const;

export const PROPOSAL_ACCEPTANCE_ATTENTION_POLICY_VERSION = "r3c.v1" as const;

export const PROPOSAL_ACCEPTANCE_APPROVE_JOB_CTA = "Approve job";
export const PROPOSAL_ACCEPTANCE_ACKNOWLEDGE_CTA = "Acknowledge";

export type ProposalAcceptanceAttentionAction =
  | "approve_job"
  | "acknowledge"
  | "disposition_blocked"
  | "none";

export function resolveProposalAcceptanceAttentionAction(input: {
  canonicalJobStage?: string | null;
  jobDisposition?: string | null;
}): ProposalAcceptanceAttentionAction {
  const disposition = String(input.jobDisposition ?? "").trim().toLowerCase();
  const stage = String(input.canonicalJobStage ?? "").trim().toLowerCase();
  if (disposition === "lost" || disposition === "closed") {
    return "disposition_blocked";
  }
  if (stage === "proposal") return "approve_job";
  if (
    stage === "approved" ||
    stage === "scheduled" ||
    stage === "production" ||
    stage === "complete"
  ) {
    return "acknowledge";
  }
  return "none";
}

/** Contractor-facing review context. Never shown on the public proposal. */
export const PROPOSAL_ACCEPTANCE_CONTRACTOR_REASON_COPY: Record<
  ProposalAcceptanceAmbiguityReason,
  string
> = {
  older_sent_version: "Customer accepted an earlier proposal",
  dirty_revision: "Customer accepted while a newer revision is in progress",
  proposal_lineage_conflict: "Accepted proposal is not the job's active proposal",
  version_pointer_conflict: "Version conflict",
  on_hold: "Job is currently On hold",
  lost: "Job is currently Lost",
  closed: "Job is currently Closed",
  conflicting_acceptance: "Another conflicting acceptance exists",
  job_not_in_proposal: "Job is not in Proposal",
  job_already_approved: "Customer accepted another proposal version",
};

export function formatProposalAcceptanceAmountLabel(
  cents: number | null | undefined
): string | null {
  if (!Number.isInteger(cents) || (cents ?? 0) < 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format((cents as number) / 100);
}

/** Clean Attention detail is package · amount. Review-required uses context copy. */
export function formatProposalAcceptanceAttentionDetail(input: {
  ambiguityReason?: string | null;
  packageLabel?: string | null;
  acceptedTotalCents?: number | null;
  acceptedAt?: string | null;
  attentionAction?: ProposalAcceptanceAttentionAction | null;
}): string | null {
  const reason = String(input.ambiguityReason ?? "").trim();
  const pkgAmount = formatProposalAcceptancePackageAmountDate({
    packageLabel: input.packageLabel,
    acceptedTotalCents: input.acceptedTotalCents,
    acceptedAt: input.acceptedAt,
  });
  if (
    input.attentionAction === "acknowledge" ||
    reason === "job_already_approved"
  ) {
    return pkgAmount;
  }
  if (
    reason &&
    (PROPOSAL_ACCEPTANCE_AMBIGUITY_REASONS as readonly string[]).includes(reason)
  ) {
    return PROPOSAL_ACCEPTANCE_CONTRACTOR_REASON_COPY[
      reason as ProposalAcceptanceAmbiguityReason
    ];
  }
  return pkgAmount;
}

export function formatProposalAcceptancePackageAmountDate(input: {
  packageLabel?: string | null;
  acceptedTotalCents?: number | null;
  acceptedAt?: string | null;
}): string | null {
  const pkg = String(input.packageLabel ?? "").trim();
  const amount = formatProposalAcceptanceAmountLabel(input.acceptedTotalCents);
  let date: string | null = null;
  const raw = String(input.acceptedAt ?? "").trim();
  if (raw) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) {
      date = new Date(ms).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  return [pkg, amount, date].filter(Boolean).join(" · ") || null;
}

export type ProposalAcceptanceGuardInput = {
  versionKind: string | null | undefined;
  frozenAt: string | null | undefined;
  acceptedVersionId: string | null | undefined;
  latestSentVersionId: string | null | undefined;
  acceptedOptionId: string | null | undefined;
  frozenSelectedOptionId: string | null | undefined;
  proposalId: string | null | undefined;
  jobActiveProposalId: string | null | undefined;
  jobId: string | null | undefined;
  proposalJobId: string | null | undefined;
  companyId: string | null | undefined;
  proposalCompanyId: string | null | undefined;
  jobCompanyId: string | null | undefined;
  draftUpdatedAt: string | null | undefined;
  canonicalJobStage: string | null | undefined;
  jobDisposition: string | null | undefined;
  hasConflictingAcceptance?: boolean;
};

export type ProposalAcceptanceGuardClassification =
  | { result: "valid_clean"; reason: null }
  | { result: "valid_review_required"; reason: ProposalAcceptanceAmbiguityReason }
  | { result: "invalid"; reason: ProposalAcceptanceInvalidReason };
