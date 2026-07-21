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
  buildProposalSendGateReadinessViewModel,
  hasProposalSendSnapshot,
  resolveSendGateCompanyName,
  resolveSendGateCustomerFirstName,
  resolveSendGateCustomerName,
  resolveSendGateProjectAddress,
  resolveSendGateRecipientEmail,
  SEND_GATE_EMAIL_PROVIDER_ACCEPTED_TITLE,
  SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL,
  SEND_GATE_PREPARING_CUSTOMER_LINK_MESSAGE,
  SEND_GATE_SENDING_PROPOSAL_EMAIL_MESSAGE,
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
  /** Flatten outer card when mounted inside the Preview command surface. */
  embedded?: boolean;
};

const SEND_PRIMARY_ACTION =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-[14px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.8)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none";

const SEND_SECONDARY_ACTION =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

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
}: ProposalCustomerPreviewSendGatePanelProps) {
  const [sessionCustomerLink, setSessionCustomerLink] = useState<SendPrepSessionLink | null>(null);
  const [prepPending, setPrepPending] = useState(false);
  const [prepErrorMessage, setPrepErrorMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [sendPending, setSendPending] = useState(false);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<EmailSendSuccess | null>(null);
  const [deliveryHistoryRefreshKey, setDeliveryHistoryRefreshKey] = useState(0);

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
        return;
      }

      setSendSuccess({
        recipientDisplay: payload.recipientDisplay,
        subject: subjectValue,
      });
      setSendErrorMessage(null);
      setDeliveryHistoryRefreshKey((key) => key + 1);
    } catch {
      setSendErrorMessage(
        "We couldn't send the proposal email yet. Check the proposal and try again."
      );
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

  const shellClass = embedded
    ? "space-y-5"
    : "space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const blockerHints = [
    previewReadiness && previewReadiness.blockingLineCount > 0
      ? `${previewReadiness.blockingLineCount} estimate item${
          previewReadiness.blockingLineCount === 1 ? "" : "s"
        } need quantities`
      : null,
    companyLogoMissing ? "Company logo missing" : null,
    readiness.messagePreview.toMissing ? "Recipient email missing" : null,
    pricingStale ? "Proposal pricing needs review" : null,
  ].filter((hint): hint is string => Boolean(hint));
  const sendBlocked = !readiness.canSend && !sendSuccess;
  const sendBlockedReason = readiness.messagePreview.toMissing
    ? "Add a recipient email before sending"
    : "Review required before sending";

  return (
    <section className={shellClass} aria-label="Send proposal readiness" data-preview-delivery-composer>
      {readiness.phase === "loading" ? (
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparing delivery details…
        </div>
      ) : null}

      {sendSuccess ? (
        <div className="flex gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-4">
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
      ) : sendBlocked ? (
        <div
          className="rounded-2xl border border-amber-200/70 bg-[linear-gradient(135deg,#fffbeb_0%,#fff_100%)] px-4 py-4"
          data-preview-delivery-blocker
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertCircle className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-900">
                Needs review before sending
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {blockerHints.length > 0
                  ? blockerHints.join(" · ")
                  : "Complete the proposal review before delivery."}
              </p>
              <Link
                href={builderHref}
                className="mt-2.5 inline-flex text-[13px] font-semibold text-blue-600 transition hover:text-blue-700"
              >
                Review in Builder
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <div>
            <p className="text-[14px] font-semibold text-slate-900">Ready to send</p>
            <p className="mt-1 text-[13px] text-slate-600">
              Recipient and proposal details are ready for delivery.
            </p>
          </div>
        </div>
      )}

      <div data-preview-delivery-recipient>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">
          Recipient
        </p>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_8px_24px_-22px_rgba(15,23,42,0.55)]">
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
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">
            Email message
          </p>
          <span className="text-[12px] text-slate-400">Proposal delivery</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_32px_-26px_rgba(15,23,42,0.6)]">
          <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center border-b border-slate-100 px-4">
            <span className="text-[12px] font-semibold text-slate-500">Subject</span>
            <input
              type="text"
              value={subjectValue}
              onChange={(event) => setSubjectDraft(event.target.value)}
              disabled={actionsLocked || Boolean(sendSuccess)}
              className="min-w-0 border-0 bg-transparent px-0 py-3.5 text-[14px] font-medium text-slate-900 outline-none placeholder:text-slate-400 disabled:text-slate-500"
              data-preview-email-subject
            />
          </label>
          <label className="block">
            <span className="sr-only">Message</span>
            <textarea
              value={bodyValue}
              onChange={(event) => setBodyDraft(event.target.value)}
              rows={8}
              disabled={actionsLocked || Boolean(sendSuccess)}
              className="block w-full resize-none border-0 bg-white px-4 py-4 text-[14px] leading-6 text-slate-700 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
              data-preview-email-message
            />
          </label>
          <div className="flex items-start gap-2.5 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
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
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {prepErrorMessage}
        </p>
      ) : null}

      {sendErrorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {sendErrorMessage}
        </p>
      ) : null}

      {copyMessage ? <p className="text-sm text-emerald-700">{copyMessage}</p> : null}

      <div className="space-y-2" data-preview-delivery-actions>
        {sessionCustomerLink ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SEND_SECONDARY_ACTION}
              disabled={actionsLocked}
              onClick={handleOpenCustomerProposal}
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
              Copy customer send link
            </button>
          </div>
        ) : canPrepareCustomerLink || prepPending ? (
          <button
            type="button"
            className={SEND_SECONDARY_ACTION}
            disabled={!canPrepareCustomerLink}
            aria-disabled={!canPrepareCustomerLink}
            onClick={() => void handlePrepareCustomerLink()}
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

        <button
          type="button"
          className={SEND_PRIMARY_ACTION}
          disabled={!canSendProposalEmail}
          aria-disabled={!canSendProposalEmail}
          title={!readiness.canSend ? readiness.disabledReason : undefined}
          onClick={() => void handleSendProposalByEmail()}
        >
          {sendPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {SEND_GATE_SENDING_PROPOSAL_EMAIL_MESSAGE}
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" aria-hidden />
              Send proposal
            </>
          )}
        </button>
        {sendBlocked ? (
          <p className="text-center text-[12.5px] text-slate-500">
            {sendBlockedReason}
          </p>
        ) : null}
      </div>

      <div className="pt-1" data-preview-delivery-history-quiet>
        <ProposalCustomerPreviewDeliveryHistorySection
          proposalId={proposalId}
          jobId={jobId}
          refreshKey={deliveryHistoryRefreshKey}
        />
      </div>

      {!hideDeferredActions ? (
        <p className="sr-only">{readiness.deferredActions.map((action) => action.label).join(", ")}</p>
      ) : null}
    </section>
  );
}
