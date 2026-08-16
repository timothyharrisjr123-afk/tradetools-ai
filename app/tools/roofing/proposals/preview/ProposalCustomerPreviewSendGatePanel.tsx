"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { deriveProposalSendFreezeReadiness } from "@/app/lib/proposalSendFreezeReadiness";
import type { ProposalCustomerPreviewReadiness } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { JobRecord } from "@/app/lib/jobTypes";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import {
  CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT,
  CUSTOMER_PREVIEW_DELIVERY_ACTIVITY_LABEL,
  CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
} from "@/app/lib/proposalBuilderDocumentIa";
import {
  buildProposalSendGateReadinessViewModel,
  hasProposalSendSnapshot,
  resolveSendGateCompanyName,
  resolveSendGateCustomerFirstName,
  resolveSendGateCustomerName,
  resolveSendGateProjectAddress,
  resolveSendGateRecipientEmail,
  SEND_GATE_CUSTOMER_LINK_HELPER,
  SEND_GATE_DELIVERY_DISABLED_MESSAGE,
  SEND_GATE_EMAIL_PROVIDER_ACCEPTED_TITLE,
  SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL,
  SEND_GATE_PREPARING_CUSTOMER_LINK_MESSAGE,
  SEND_GATE_SENDING_PROPOSAL_EMAIL_MESSAGE,
  SEND_GATE_SEND_PROPOSAL_LABEL,
  SEND_GATE_SEND_REVISION_LABEL,
  resolveSendGateSheetTitle,
} from "@/app/lib/proposalSendGateReadiness";
import ProposalCustomerPreviewDeliveryHistorySection from "./ProposalCustomerPreviewDeliveryHistorySection";

type SendPrepSessionLink = {
  publicUrl: string;
  tokenPrefix: string;
  expiresAt: string | null;
};

type EmailSendSuccess = {
  recipientDisplay: string;
  subject: string;
};

type ProposalCustomerPreviewSendGatePanelProps = {
  jobId: string;
  proposalId: string;
  graph: ProposalDraftGraph | null;
  job: JobRecord | null;
  previewReadiness: ProposalCustomerPreviewReadiness | null;
  pricingStale?: boolean;
  loading: boolean;
  emailDeliveryConfigured: boolean;
  companyLogoMissing?: boolean;
  builderHref: string;
  /** Block 5 Roofr-first Preview — hide Signature/PDF/Payment staging rows. */
  hideDeferredActions?: boolean;
  /** Flatten outer card when mounted inside the Preview send sheet. */
  embedded?: boolean;
  /** V2C4 — Refresh Preview sent/frozen chrome after send (freeze may precede delivery). */
  onSendCompleted?: () => void;
  /** Dirty draft after a prior sent version — same send engine, revision copy. */
  isRevisionSend?: boolean;
};

const SEND_PRIMARY_ACTION =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-[14px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.8)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none";

const SEND_SECONDARY_ACTION =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:min-h-10";

function buildSendBlockerHints(input: {
  previewReadiness: ProposalCustomerPreviewReadiness | null;
  companyLogoMissing: boolean;
  recipientMissing: boolean;
  pricingStale: boolean;
  emailDeliveryConfigured: boolean;
}): string[] {
  const hints: string[] = [];
  const blockingLineCount = input.previewReadiness?.blockingLineCount ?? 0;
  if (blockingLineCount > 0) {
    hints.push(
      `${blockingLineCount} estimate item${blockingLineCount === 1 ? "" : "s"} need quantities`
    );
  } else if (input.previewReadiness?.pricingComplete === false) {
    hints.push("Estimate pricing needs review");
  }
  if (input.companyLogoMissing) {
    hints.push(CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT);
  }
  if (input.recipientMissing) {
    hints.push("Recipient email missing");
  }
  if (input.pricingStale) {
    hints.push("Proposal pricing needs review");
  }
  if (!input.emailDeliveryConfigured) {
    hints.push(SEND_GATE_DELIVERY_DISABLED_MESSAGE);
  }
  return hints;
}

export default function ProposalCustomerPreviewSendGatePanel({
  jobId,
  proposalId,
  graph,
  job,
  previewReadiness,
  pricingStale = false,
  loading,
  emailDeliveryConfigured,
  companyLogoMissing = false,
  builderHref,
  hideDeferredActions = false,
  embedded = false,
  onSendCompleted,
  isRevisionSend = false,
}: ProposalCustomerPreviewSendGatePanelProps) {
  const [sessionCustomerLink, setSessionCustomerLink] = useState<SendPrepSessionLink | null>(null);
  const [prepPending, setPrepPending] = useState(false);
  const [prepErrorMessage, setPrepErrorMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [sendPending, setSendPending] = useState(false);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<EmailSendSuccess | null>(null);
  const [deliveryHistoryRefreshKey, setDeliveryHistoryRefreshKey] = useState(0);
  const [deliveryActivitySummary, setDeliveryActivitySummary] = useState<string | null>(null);

  const sendFreezeReadiness = useMemo(() => {
    if (!graph || loading) return null;
    return deriveProposalSendFreezeReadiness({
      graph,
      pricingStale,
    });
  }, [graph, loading, pricingStale]);

  const recipientEmail = useMemo(
    () => resolveSendGateRecipientEmail({ graph, job }),
    [graph, job]
  );

  const companyName = useMemo(() => resolveSendGateCompanyName(graph), [graph]);
  const projectAddress = useMemo(() => resolveSendGateProjectAddress(graph), [graph]);
  const customerName = useMemo(() => resolveSendGateCustomerName(graph, job), [graph, job]);
  const customerFirstName = useMemo(
    () => resolveSendGateCustomerFirstName(customerName),
    [customerName]
  );

  const readiness = useMemo(
    () =>
      buildProposalSendGateReadinessViewModel({
        loading,
        hasSentSnapshot: graph ? hasProposalSendSnapshot(graph.proposal) : false,
        sendFreezeReadiness,
        previewReadiness,
        recipientEmail,
        customerFirstName,
        companyName,
        projectAddress,
        pricingStale,
        emailDeliveryConfigured,
      }),
    [
      companyName,
      customerFirstName,
      emailDeliveryConfigured,
      graph,
      loading,
      previewReadiness,
      pricingStale,
      recipientEmail,
      sendFreezeReadiness,
      projectAddress,
    ]
  );

  const actionsLocked = prepPending || sendPending;

  const canPrepareCustomerLink =
    readiness.canPrepareCustomerLink && !actionsLocked && !sessionCustomerLink;

  const canSendProposalEmail =
    readiness.canSend && !actionsLocked && !sendSuccess && Boolean(recipientEmail);

  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);

  const subjectValue = subjectDraft ?? readiness.messagePreview.subject;
  const bodyValue = bodyDraft ?? readiness.messagePreview.body;

  async function handlePrepareCustomerLink() {
    if (!canPrepareCustomerLink || !recipientEmail) {
      return;
    }

    setPrepPending(true);
    setPrepErrorMessage(null);
    setCopyMessage(null);

    try {
      const response = await fetch("/api/proposals/send-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          jobId,
          recipientEmail,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok: true;
            publicUrl: string;
            tokenPrefix: string;
            expiresAt: string | null;
            snapshotStatus: string;
            deliveryEnabled: false;
          }
        | { ok: false; message?: string }
        | null;

      if (!response.ok || !payload || payload.ok !== true || !payload.publicUrl) {
        setPrepErrorMessage(
          payload && payload.ok === false && payload.message
            ? payload.message
            : "We couldn't prepare a customer link yet. Check the proposal and try again."
        );
        setSessionCustomerLink(null);
        return;
      }

      setSessionCustomerLink({
        publicUrl: payload.publicUrl,
        tokenPrefix: payload.tokenPrefix,
        expiresAt: payload.expiresAt,
      });
      setPrepErrorMessage(null);
    } catch {
      setPrepErrorMessage(
        "We couldn't prepare a customer link yet. Check the proposal and try again."
      );
      setSessionCustomerLink(null);
    } finally {
      setPrepPending(false);
    }
  }

  async function handleSendProposalByEmail() {
    if (!canSendProposalEmail || !recipientEmail) {
      return;
    }

    setSendPending(true);
    setSendErrorMessage(null);
    setCopyMessage(null);

    try {
      const response = await fetch("/api/proposals/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          jobId,
          recipientEmail,
          subject: subjectValue,
          body: bodyValue,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok: true;
            deliveryAttemptId: string;
            deliveryStatus: "provider_accepted";
            recipientDisplay: string;
            deliveryEnabled: true;
            snapshotStatus?: string;
          }
        | {
            ok: false;
            code?: string;
            message?: string;
            deliveryAttemptId?: string;
            deliveryStatus?: "failed";
          }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        setSendErrorMessage(
          payload && payload.ok === false && payload.message
            ? payload.message
            : "We couldn't send the proposal email yet. Check the proposal and try again."
        );
        // Freeze may have committed before delivery failure — refresh chrome truth.
        onSendCompleted?.();
        return;
      }

      setSendSuccess({
        recipientDisplay: payload.recipientDisplay,
        subject: subjectValue,
      });
      setSendErrorMessage(null);
      setDeliveryHistoryRefreshKey((key) => key + 1);
      onSendCompleted?.();
    } catch {
      setSendErrorMessage(
        "We couldn't send the proposal email yet. Check the proposal and try again."
      );
      onSendCompleted?.();
    } finally {
      setSendPending(false);
    }
  }

  function handleOpenCustomerProposal() {
    if (!sessionCustomerLink?.publicUrl || actionsLocked) {
      return;
    }

    window.open(sessionCustomerLink.publicUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCopyCustomerSendLink() {
    if (!sessionCustomerLink?.publicUrl || actionsLocked) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sessionCustomerLink.publicUrl);
      setCopyMessage("Customer send link copied.");
    } catch {
      setCopyMessage("Could not copy the customer send link.");
    }
  }

  const shellClass = embedded ? "space-y-4" : "space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const blockerHints = buildSendBlockerHints({
    previewReadiness,
    companyLogoMissing,
    recipientMissing: readiness.messagePreview.toMissing,
    pricingStale,
    emailDeliveryConfigured,
  });
  const sendBlocked = !readiness.canSend && !sendSuccess;

  return (
    <section
      className={shellClass}
      aria-label={resolveSendGateSheetTitle(isRevisionSend)}
      data-preview-delivery-composer
      data-preview-send-gate-v2c2
    >
      {readiness.phase === "loading" ? (
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparing delivery details…
        </div>
      ) : null}

      {sendSuccess ? (
        <div
          className="flex gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3.5"
          data-preview-send-success
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <div>
            <p className="text-[14px] font-semibold text-emerald-950">
              {SEND_GATE_EMAIL_PROVIDER_ACCEPTED_TITLE}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-emerald-800">
              Sent to {sendSuccess.recipientDisplay} · {sendSuccess.subject}
            </p>
          </div>
        </div>
      ) : null}

      {sendBlocked ? (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3.5"
          data-preview-delivery-blocker
          data-preview-send-blocker
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-900">
                {CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {blockerHints.length > 0
                  ? blockerHints.join(" · ")
                  : readiness.disabledReason || "Complete the proposal review before delivery."}
              </p>
              <Link
                href={builderHref}
                className="mt-2.5 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-blue-600 transition hover:text-blue-700 sm:min-h-0"
                data-preview-send-return-to-builder
              >
                {CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div data-preview-delivery-recipient>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Recipient
        </p>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <UserRound className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-slate-900">
              {customerName ?? "Customer"}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-slate-500">
              {readiness.messagePreview.toMissing
                ? "Recipient email needed"
                : readiness.messagePreview.to}
            </p>
          </div>
        </div>
      </div>

      <div data-preview-email-composer>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Email message
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          <label className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center border-b border-slate-100 px-3.5">
            <span className="text-[12px] font-semibold text-slate-500">Subject</span>
            <input
              type="text"
              value={subjectValue}
              onChange={(event) => setSubjectDraft(event.target.value)}
              disabled={actionsLocked || Boolean(sendSuccess)}
              className="min-w-0 border-0 bg-transparent px-0 py-3 text-[14px] font-medium text-slate-900 outline-none placeholder:text-slate-400 disabled:text-slate-500"
              data-preview-email-subject
            />
          </label>
          <label className="block">
            <span className="sr-only">Message</span>
            <textarea
              value={bodyValue}
              onChange={(event) => setBodyDraft(event.target.value)}
              rows={6}
              disabled={actionsLocked || Boolean(sendSuccess)}
              className="block w-full resize-none border-0 bg-white px-3.5 py-3 text-[14px] leading-6 text-slate-700 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
              data-preview-email-message
            />
          </label>
          <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-slate-500">
              {sessionCustomerLink
                ? "Your secure proposal link is ready and will be included."
                : "A secure proposal link will be included when sent."}
            </p>
          </div>
        </div>
      </div>

      {prepErrorMessage ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
          data-preview-send-prep-error
          role="alert"
        >
          {prepErrorMessage}
        </p>
      ) : null}

      {sendErrorMessage ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
          data-preview-send-error
          role="alert"
        >
          {sendErrorMessage}
        </p>
      ) : null}

      {copyMessage ? <p className="text-sm text-emerald-700">{copyMessage}</p> : null}

      <div className="space-y-2.5" data-preview-delivery-actions>
        <button
          type="button"
          className={SEND_PRIMARY_ACTION}
          disabled={!canSendProposalEmail}
          aria-disabled={!canSendProposalEmail}
          title={!readiness.canSend ? readiness.disabledReason : undefined}
          onClick={() => void handleSendProposalByEmail()}
          data-preview-send-proposal
        >
          {sendPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {SEND_GATE_SENDING_PROPOSAL_EMAIL_MESSAGE}
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" aria-hidden />
              {isRevisionSend ? SEND_GATE_SEND_REVISION_LABEL : SEND_GATE_SEND_PROPOSAL_LABEL}
            </>
          )}
        </button>

        {!sendSuccess ? (
          <details className="rounded-lg border border-slate-200/80 bg-white" data-preview-send-link-optional>
            <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[12.5px] font-semibold text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
              Optional: preview or share link first
            </summary>
            <div className="space-y-2 border-t border-slate-100 px-3.5 py-3">
              <p className="text-[12.5px] leading-relaxed text-slate-500">
                {sessionCustomerLink
                  ? "Secure link ready — open or copy before sending."
                  : SEND_GATE_CUSTOMER_LINK_HELPER}
              </p>
              {sessionCustomerLink ? (
                <div className="flex flex-wrap gap-2" data-preview-customer-link-ready>
                  <button
                    type="button"
                    className={SEND_SECONDARY_ACTION}
                    disabled={actionsLocked}
                    onClick={handleOpenCustomerProposal}
                    data-preview-open-customer-proposal
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open customer proposal
                  </button>
                  <button
                    type="button"
                    className={SEND_SECONDARY_ACTION}
                    disabled={actionsLocked}
                    onClick={() => void handleCopyCustomerSendLink()}
                  >
                    <Link2 className="h-4 w-4" aria-hidden />
                    Copy link
                  </button>
                </div>
              ) : canPrepareCustomerLink || prepPending ? (
                <button
                  type="button"
                  className={SEND_SECONDARY_ACTION}
                  disabled={!canPrepareCustomerLink}
                  aria-disabled={!canPrepareCustomerLink}
                  onClick={() => void handlePrepareCustomerLink()}
                  data-preview-create-secure-link
                >
                  {prepPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {SEND_GATE_PREPARING_CUSTOMER_LINK_MESSAGE}
                    </>
                  ) : (
                    SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL
                  )}
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>

      <details
        className="rounded-lg border border-slate-200/70 bg-white/80"
        data-preview-delivery-history-quiet
        data-preview-delivery-activity-v2c3
      >
        <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[12.5px] font-semibold text-slate-500 marker:content-none [&::-webkit-details-marker]:hidden">
          <span data-preview-delivery-activity-label>
            {CUSTOMER_PREVIEW_DELIVERY_ACTIVITY_LABEL}
          </span>
          {deliveryActivitySummary ? (
            <span
              className="mt-0.5 block text-[12px] font-normal text-slate-400"
              data-preview-delivery-activity-summary
            >
              {deliveryActivitySummary}
            </span>
          ) : null}
        </summary>
        <div className="border-t border-slate-100 px-3.5 py-3">
          <ProposalCustomerPreviewDeliveryHistorySection
            proposalId={proposalId}
            jobId={jobId}
            refreshKey={deliveryHistoryRefreshKey}
            embedded
            onSummaryChange={setDeliveryActivitySummary}
          />
        </div>
      </details>

      {!hideDeferredActions ? (
        <p className="sr-only">{readiness.deferredActions.map((action) => action.label).join(", ")}</p>
      ) : null}
    </section>
  );
}
