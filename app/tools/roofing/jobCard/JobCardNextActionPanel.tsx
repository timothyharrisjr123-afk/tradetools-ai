"use client";

import {
  attentionHeadline,
  type JobAttentionSafeItem,
} from "@/app/lib/jobAttentionReadModel";
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
  onSelect: (attentionId: string) => void;
  onMarkRead: (attentionId: string) => Promise<boolean>;
  onMarkSeen: (item: JobAttentionSafeItem) => Promise<void>;
  onDismiss: (item: JobAttentionSafeItem) => Promise<void>;
  onReviewProposal: (item: JobAttentionSafeItem) => void;
  onConfirmAcceptance?: (item: JobAttentionSafeItem) => Promise<void>;
  onAcknowledgeAcceptance?: (item: JobAttentionSafeItem) => Promise<void>;
  onConnectPayments?: (item: JobAttentionSafeItem) => void;
  /** Canonical Job stage for lifecycle action eligibility (DB jobs only). */
  canonicalJobStage?: CanonicalJobStage | null;
  /** jobs.status disposition for lifecycle action eligibility. */
  jobDisposition?: string | null;
};

const PRIMARY_BUTTON =
  "inline-flex min-h-9 items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60";
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
  onSelect,
  onMarkRead,
  onMarkSeen,
  onDismiss,
  onReviewProposal,
  onConfirmAcceptance,
  onAcknowledgeAcceptance,
  onConnectPayments,
  canonicalJobStage = null,
  jobDisposition = null,
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

  if (!selectedItem) return null;

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
  const approveLifecycleEligible = resolveCanonicalJobActionEligibilityFromFacts(
    {
      stage: canonicalJobStage ?? "intake",
      disposition: jobDisposition,
      schedule: null,
      approvalAcceptancePending: true,
    }
  ).canApproveJob;
  const showApproveJob =
    selectedItem.attentionType === "acceptance_confirmation_required" &&
    acceptanceAction === "approve_job" &&
    Boolean(onConfirmAcceptance) &&
    approveLifecycleEligible;
  const showAcknowledge =
    selectedItem.attentionType === "acceptance_confirmation_required" &&
    acceptanceAction === "acknowledge" &&
    Boolean(onAcknowledgeAcceptance);
  const showConnectPayments =
    selectedItem.attentionType === "payments_not_connected";
  const showPaymentFailed = selectedItem.attentionType === "payment_failed";
  const showReviewAcceptedVersion =
    selectedItem.attentionType === "acceptance_confirmation_required" &&
    (showAcknowledge || selectedItem.acceptance?.reviewRequired === true);

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

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="job-card-next-action-heading"
      className="border-b border-amber-200/80 bg-amber-50/70 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 sm:px-6"
      data-jobcard-next-action
      data-jobcard-next-action-compact
      data-attention-id={selectedItem.id}
      data-attention-status={selectedItem.status}
    >
      <h2 id="job-card-next-action-heading" className="sr-only">
        Needs attention
      </h2>
      <div className="mx-auto flex max-w-[96rem] flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">
            {attentionHeadline(selectedItem)}
          </p>
          {(() => {
            const preview =
              selectedItem.attentionType === "acceptance_confirmation_required"
                ? selectedItem.acceptance?.contractorReason
                : selectedItem.request?.messagePreview;
            return preview ? (
              <p
                className="mt-0.5 max-w-3xl text-xs leading-relaxed text-slate-700"
                data-attention-message-preview
              >
                {preview}
              </p>
            ) : null;
          })()}
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
                void settleReadWithoutBlocking(onMarkRead(selectedItem.id)).catch(
                  () => undefined
                );
              }}
            >
              Review payment
            </button>
          ) : (
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
              <summary className={`${QUIET_BUTTON} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
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
          {selectedItem.attentionType === "acceptance_confirmation_required" ||
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
            className="inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
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
                  className="min-w-0 rounded-md px-2 py-1.5 text-left hover:bg-amber-100/80"
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
