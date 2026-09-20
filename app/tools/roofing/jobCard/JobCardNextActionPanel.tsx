"use client";

import {
  attentionHeadline,
  type JobAttentionSafeItem,
} from "@/app/lib/jobAttentionReadModel";
import {
  AGREEMENT_JOB_CARD_ACCEPTED_HEADING,
  AGREEMENT_JOB_CARD_AWAITING_APPROVAL,
  AGREEMENT_JOB_CARD_RECONCILE_HEADING,
  projectProposalAgreement,
} from "@/app/lib/proposalAgreementProjection";
import { resolveCanonicalJobActionEligibilityFromFacts } from "@/app/lib/jobLifecycleActionEligibility";
import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type JobCardNextActionPanelProps = {
  items: JobAttentionSafeItem[];
  selectedItem: JobAttentionSafeItem | null;
  focusRequested: boolean;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
  pendingAttentionId?: string | null;
  detailStatus?: "loading" | "ready-empty" | "ready-items" | "error";
  detailError?: string | null;
  onSelect: (attentionId: string) => void;
  onMarkRead: (attentionId: string) => Promise<boolean>;
  onMarkSeen: (item: JobAttentionSafeItem) => Promise<void>;
  onDismiss: (item: JobAttentionSafeItem) => Promise<void>;
  onReviewProposal: (item: JobAttentionSafeItem) => void;
  onConfirmAcceptance?: (item: JobAttentionSafeItem) => Promise<void>;
  onAcknowledgeAcceptance?: (item: JobAttentionSafeItem) => Promise<void>;
  onConnectPayments?: (item: JobAttentionSafeItem) => void;
  onReviewPayment?: (item: JobAttentionSafeItem) => void;
  /** Canonical Job stage for lifecycle action eligibility (DB jobs only). */
  canonicalJobStage?: CanonicalJobStage | null;
  /** jobs.status disposition for lifecycle action eligibility. */
  jobDisposition?: string | null;
  /** Optional signature evidence for the selected acceptance. */
  hasSignatureEvidence?: boolean;
};

const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60";
const QUIET_BUTTON =
  "inline-flex min-h-9 items-center justify-center px-1 text-xs font-semibold text-slate-500 transition hover:text-slate-800 disabled:opacity-60";
const CONTACT_LINK =
  "inline-flex min-h-8 items-center gap-1.5 px-1 text-xs font-semibold text-slate-600 hover:text-slate-900";

function normalizedContactHref(
  kind: "phone" | "email",
  value: string | null
): string | null {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  return kind === "phone"
    ? `tel:${normalized.replace(/[^\d+*#,;]/g, "")}`
    : `mailto:${normalized}`;
}

async function settleReadWithoutBlocking(
  read: Promise<boolean>
): Promise<void> {
  await Promise.race([
    read.catch(() => false),
    new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(false), 250);
    }),
  ]);
}

export default function JobCardNextActionPanel({
  items,
  selectedItem,
  focusRequested,
  fallbackPhone = null,
  fallbackEmail = null,
  pendingAttentionId = null,
  detailStatus = "ready-empty",
  detailError = null,
  onSelect,
  onMarkRead,
  onMarkSeen,
  onDismiss,
  onReviewProposal,
  onConfirmAcceptance,
  onAcknowledgeAcceptance,
  onConnectPayments,
  onReviewPayment,
  canonicalJobStage = null,
  jobDisposition = null,
  hasSignatureEvidence = false,
}: JobCardNextActionPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const focusedAttentionRef = useRef<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (
      !focusRequested ||
      !selectedItem ||
      focusedAttentionRef.current === selectedItem.id
    ) {
      return;
    }
    focusedAttentionRef.current = selectedItem.id;
    panelRef.current?.focus({ preventScroll: false });
    void onMarkRead(selectedItem.id).catch(() => false);
  }, [focusRequested, onMarkRead, selectedItem]);

  if (!selectedItem) {
    if (detailStatus === "error") {
      return (
        <p
          className="px-4 py-2 text-xs text-slate-600"
          data-attention-detail-error
        >
          {detailError?.trim() || "Attention could not be loaded."}
        </p>
      );
    }
    return null;
  }

  const phone =
    selectedItem.request?.customerPhone?.trim() ||
    fallbackPhone?.trim() ||
    null;
  const email =
    selectedItem.request?.customerEmail?.trim() ||
    selectedItem.acceptance?.acceptedByEmail?.trim() ||
    fallbackEmail?.trim() ||
    null;
  const phoneHref = normalizedContactHref("phone", phone);
  const emailHref = normalizedContactHref("email", email);
  const others = items.filter((item) => item.id !== selectedItem.id);
  const pending = pendingAttentionId === selectedItem.id;
  const acceptanceAction = selectedItem.acceptance?.attentionAction ?? null;
  const isAcceptanceAttention =
    selectedItem.attentionType === "acceptance_confirmation_required";

  const agreement = isAcceptanceAttention
    ? projectProposalAgreement({
        canonicalJobStage: canonicalJobStage ?? "intake",
        jobDisposition,
        acceptance: selectedItem.acceptance
          ? {
              id: selectedItem.acceptance.acceptanceId,
              proposalId: selectedItem.proposalId ?? "",
              proposalVersionId: selectedItem.proposalVersionId ?? "",
              optionLabel: selectedItem.acceptance.packageLabel,
              acceptedTotalCents: selectedItem.acceptance.acceptedTotalCents,
              acceptedAt: selectedItem.acceptance.acceptedAt,
              acceptedByName: selectedItem.acceptance.acceptedByName,
              acceptedByEmail: selectedItem.acceptance.acceptedByEmail,
              guardResult: selectedItem.acceptance.reviewRequired
                ? "valid_review_required"
                : "valid_clean",
              ambiguityReason: selectedItem.acceptance.ambiguityReason,
              confirmedAt: null,
            }
          : null,
        signature:
          hasSignatureEvidence && selectedItem.acceptance
            ? {
                id: "evidence",
                acceptanceId: selectedItem.acceptance.acceptanceId,
              }
            : null,
        classifyHistoricalOnly: selectedItem.acceptance?.reviewRequired === true,
      })
    : null;

  const approveLifecycleEligible = resolveCanonicalJobActionEligibilityFromFacts(
    {
      stage: canonicalJobStage ?? "intake",
      disposition: jobDisposition,
      schedule: null,
      approvalAcceptancePending: true,
    }
  ).canApproveJob;

  const showApproveJob =
    isAcceptanceAttention &&
    acceptanceAction === "approve_job" &&
    Boolean(onConfirmAcceptance) &&
    (agreement?.jobCardShowApprove ?? approveLifecycleEligible) &&
    agreement?.jobCardTreatment !== "warning";
  const showAcknowledge =
    isAcceptanceAttention &&
    acceptanceAction === "acknowledge" &&
    Boolean(onAcknowledgeAcceptance);
  const showConnectPayments =
    selectedItem.attentionType === "payments_not_connected";
  const showPaymentFailed = selectedItem.attentionType === "payment_failed";
  const showReviewAcceptedVersion =
    isAcceptanceAttention &&
    (showAcknowledge || selectedItem.acceptance?.reviewRequired === true);

  const normalAcceptance =
    isAcceptanceAttention &&
    (agreement?.jobCardTreatment === "normal" ||
      agreement?.jobCardTreatment === "signed_support") &&
    !showAcknowledge;
  const warningAcceptance =
    isAcceptanceAttention && agreement?.jobCardTreatment === "warning";

  const openContact = async (href: string) => {
    await settleReadWithoutBlocking(onMarkRead(selectedItem.id));
    window.location.href = href;
  };

  const reviewProposal = () => {
    void settleReadWithoutBlocking(onMarkRead(selectedItem.id))
      .then(() => onMarkSeen(selectedItem).catch(() => undefined))
      .then(() => onReviewProposal(selectedItem))
      .catch(() => undefined);
  };

  const heading = normalAcceptance
    ? AGREEMENT_JOB_CARD_ACCEPTED_HEADING
    : warningAcceptance
      ? AGREEMENT_JOB_CARD_RECONCILE_HEADING
      : attentionHeadline(selectedItem);

  const supportingLines = normalAcceptance
    ? (agreement?.jobCardSupporting ?? AGREEMENT_JOB_CARD_AWAITING_APPROVAL)
        .split("\n")
        .filter(Boolean)
    : warningAcceptance
      ? [selectedItem.acceptance?.contractorReason].filter(Boolean)
      : selectedItem.attentionType === "acceptance_confirmation_required"
        ? [selectedItem.acceptance?.contractorReason].filter(Boolean)
        : [selectedItem.request?.messagePreview].filter(Boolean);

  const sectionClass = warningAcceptance
    ? "border-b border-amber-200/80 bg-amber-50/70 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 sm:px-6"
    : normalAcceptance
      ? "border-b border-slate-200/80 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 sm:px-6"
      : "border-b border-amber-200/80 bg-amber-50/70 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 sm:px-6";

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="job-card-next-action-heading"
      className={sectionClass}
      data-jobcard-next-action
      data-jobcard-next-action-compact
      data-jobcard-agreement-treatment={
        agreement?.jobCardTreatment ?? "attention"
      }
      data-attention-id={selectedItem.id}
      data-attention-status={selectedItem.status}
    >
      <h2
        id="job-card-next-action-heading"
        className={
          normalAcceptance
            ? "text-base font-semibold text-slate-950"
            : "sr-only"
        }
      >
        {normalAcceptance ? heading : "Needs attention"}
      </h2>
      {detailStatus === "error" ? (
        <p
          className={`mb-1 text-[11px] ${
            normalAcceptance ? "text-slate-600" : "text-amber-900/80"
          }`}
          data-attention-detail-error
        >
          {detailError?.trim() || "Attention could not be refreshed."} Showing
          last known items.
        </p>
      ) : null}
      <div className="mx-auto flex max-w-[96rem] flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {normalAcceptance ? null : (
            <p className="text-sm font-semibold text-slate-950">{heading}</p>
          )}
          {supportingLines.map((line) => (
            <p
              key={line}
              className={`max-w-3xl text-sm leading-relaxed text-slate-700 ${
                normalAcceptance ? "mt-1" : "mt-0.5 text-xs"
              }`}
              data-attention-message-preview
            >
              {line}
            </p>
          ))}
        </div>

        <div
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 sm:w-auto sm:justify-end"
          aria-busy={pending}
        >
          {showApproveJob ? (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              data-attention-confirm-acceptance
              disabled={pending}
              onClick={() => {
                void settleReadWithoutBlocking(onMarkRead(selectedItem.id))
                  .then(() => onConfirmAcceptance?.(selectedItem))
                  .catch(() => undefined);
              }}
            >
              Approve job
            </button>
          ) : showAcknowledge ? (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              data-attention-acknowledge-acceptance
              disabled={pending}
              onClick={() => {
                void settleReadWithoutBlocking(onMarkRead(selectedItem.id))
                  .then(() => onAcknowledgeAcceptance?.(selectedItem))
                  .catch(() => undefined);
              }}
            >
              Acknowledge
            </button>
          ) : showConnectPayments ? (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              data-attention-connect-payments
              onClick={() => {
                void settleReadWithoutBlocking(onMarkRead(selectedItem.id))
                  .then(() => {
                    if (onConnectPayments) onConnectPayments(selectedItem);
                    else window.location.href = "/tools/settings/payments";
                  })
                  .catch(() => undefined);
              }}
            >
              Connect payments
            </button>
          ) : showPaymentFailed ? (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              data-attention-review-payment
              onClick={() => {
                void settleReadWithoutBlocking(onMarkRead(selectedItem.id))
                  .then(() => {
                    if (onReviewPayment) onReviewPayment(selectedItem);
                  })
                  .catch(() => undefined);
              }}
            >
              Review payment
            </button>
          ) : normalAcceptance ? null : (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              data-attention-review
              onClick={reviewProposal}
            >
              Review proposal
            </button>
          )}
          {showReviewAcceptedVersion ? (
            <button
              type="button"
              className={QUIET_BUTTON}
              data-attention-review
              onClick={reviewProposal}
            >
              Review accepted version
            </button>
          ) : null}
          {phoneHref && emailHref ? (
            <details className="relative" data-attention-contact>
              <summary
                className={`${QUIET_BUTTON} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
              >
                Contact customer
              </summary>
              <div className="absolute right-0 z-10 mt-1 min-w-[9.5rem] rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  className={CONTACT_LINK}
                  onClick={() => {
                    void openContact(phoneHref);
                  }}
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Call
                </button>
                <button
                  type="button"
                  className={CONTACT_LINK}
                  onClick={() => {
                    void openContact(emailHref);
                  }}
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  Email
                </button>
              </div>
            </details>
          ) : phoneHref || emailHref ? (
            <button
              type="button"
              className={QUIET_BUTTON}
              data-attention-contact
              onClick={() => {
                void openContact((phoneHref ?? emailHref)!);
              }}
            >
              Contact customer
            </button>
          ) : null}
          {isAcceptanceAttention ||
          selectedItem.attentionType === "payments_not_connected" ||
          selectedItem.attentionType === "payment_failed" ? null : (
            <button
              type="button"
              className={QUIET_BUTTON}
              disabled={pending}
              data-attention-dismiss
              onClick={() => {
                void settleReadWithoutBlocking(onMarkRead(selectedItem.id))
                  .then(() => onDismiss(selectedItem))
                  .catch(() => undefined);
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {others.length > 0 ? (
        <div className="mx-auto mt-1.5 max-w-[96rem]">
          <button
            type="button"
            className={`inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-xs font-semibold ${
              normalAcceptance
                ? "text-slate-700 hover:bg-slate-100"
                : "text-amber-900 hover:bg-amber-100"
            }`}
            aria-expanded={showMore}
            onClick={() => setShowMore((value) => !value)}
          >
            View {others.length} more
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${showMore ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {showMore ? (
            <div
              className="mt-1 grid gap-1 sm:grid-cols-2"
              data-jobcard-additional-attention
            >
              {others.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`min-w-0 rounded-md px-2 py-1.5 text-left ${
                    normalAcceptance
                      ? "hover:bg-slate-100"
                      : "hover:bg-amber-100/80"
                  }`}
                  onClick={() => {
                    onSelect(item.id);
                    window.requestAnimationFrame(() => {
                      panelRef.current?.focus({ preventScroll: true });
                      void onMarkRead(item.id).catch(() => false);
                    });
                    setShowMore(false);
                  }}
                >
                  <span className="block truncate text-xs font-semibold text-slate-900">
                    {attentionHeadline(item)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
