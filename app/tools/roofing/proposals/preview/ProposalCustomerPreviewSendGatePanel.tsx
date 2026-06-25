"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Link2, Loader2 } from "lucide-react";
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
  SEND_GATE_CUSTOMER_LINK_READY_BODY,
  SEND_GATE_CUSTOMER_LINK_READY_LABEL,
  SEND_GATE_CUSTOMER_LINK_READY_TITLE,
  SEND_GATE_DELIVERY_DISABLED_MESSAGE,
  SEND_GATE_PANEL_TITLE,
  SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL,
  SEND_GATE_PREPARING_CUSTOMER_LINK_MESSAGE,
  type SendGateChecklistStatus,
} from "@/app/lib/proposalSendGateReadiness";
import { BUILDER_CARD, BUILDER_DISABLED_ACTION } from "../builder/proposalBuilderConstants";

type SendPrepSessionLink = {
  publicUrl: string;
  tokenPrefix: string;
  expiresAt: string | null;
};

type ProposalCustomerPreviewSendGatePanelProps = {
  jobId: string;
  proposalId: string;
  graph: ProposalDraftGraph | null;
  job: JobRecord | null;
  previewReadiness: ProposalCustomerPreviewReadiness | null;
  pricingStale?: boolean;
  loading: boolean;
};

const SEND_PRIMARY_ACTION =
  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-300 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto";

const SEND_SECONDARY_ACTION =
  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 sm:w-auto";

function checklistStatusClass(status: SendGateChecklistStatus): string {
  switch (status) {
    case "ready":
      return "text-emerald-700";
    case "missing":
    case "needs_sent_snapshot":
      return "text-amber-800";
    case "needs_review":
      return "text-amber-900";
    case "loading":
      return "text-slate-500";
    default:
      return "text-slate-700";
  }
}

export default function ProposalCustomerPreviewSendGatePanel({
  jobId,
  proposalId,
  graph,
  job,
  previewReadiness,
  pricingStale = false,
  loading,
}: ProposalCustomerPreviewSendGatePanelProps) {
  const [sessionCustomerLink, setSessionCustomerLink] = useState<SendPrepSessionLink | null>(null);
  const [prepPending, setPrepPending] = useState(false);
  const [prepErrorMessage, setPrepErrorMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

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
      }),
    [
      companyName,
      customerFirstName,
      graph,
      loading,
      previewReadiness,
      pricingStale,
      recipientEmail,
      sendFreezeReadiness,
      projectAddress,
    ]
  );

  const canPrepareCustomerLink =
    readiness.canPrepareCustomerLink && !prepPending && !sessionCustomerLink;

  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);

  const subjectValue = subjectDraft ?? readiness.messagePreview.subject;
  const bodyValue = bodyDraft ?? readiness.messagePreview.body;
  const linkLabel = sessionCustomerLink
    ? SEND_GATE_CUSTOMER_LINK_READY_LABEL
    : readiness.messagePreview.linkLabel;

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

  function handleOpenCustomerProposal() {
    if (!sessionCustomerLink?.publicUrl) {
      return;
    }

    window.open(sessionCustomerLink.publicUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCopyCustomerSendLink() {
    if (!sessionCustomerLink?.publicUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sessionCustomerLink.publicUrl);
      setCopyMessage("Customer send link copied.");
    } catch {
      setCopyMessage("Could not copy the customer send link.");
    }
  }

  return (
    <section
      className={`${BUILDER_CARD} space-y-5 border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80`}
      aria-label="Send proposal readiness"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {SEND_GATE_PANEL_TITLE}
        </p>
        {readiness.phase === "loading" ? (
          <p className="text-sm text-slate-500">{readiness.summary}</p>
        ) : sessionCustomerLink ? (
          <>
            <p className="text-sm font-medium text-slate-900">{SEND_GATE_CUSTOMER_LINK_READY_TITLE}</p>
            <p className="text-sm text-slate-600">{SEND_GATE_CUSTOMER_LINK_READY_BODY}</p>
            <p className="text-sm text-slate-500">{SEND_GATE_DELIVERY_DISABLED_MESSAGE}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-700">{readiness.summary}</p>
            {readiness.body ? <p className="text-sm text-slate-600">{readiness.body}</p> : null}
            <p className="text-sm text-slate-500">{SEND_GATE_DELIVERY_DISABLED_MESSAGE}</p>
          </>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Readiness checklist</h3>
        <ul className="space-y-2">
          {readiness.checklist.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-md border border-slate-200/80 bg-white px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <span className="text-sm font-medium text-slate-900">{item.label}</span>
              <span className={`text-sm ${checklistStatusClass(item.status)}`}>{item.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Message preview</h3>
        <div className="space-y-3 rounded-md border border-slate-200/80 bg-white px-4 py-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">To</span>
            <input
              type="text"
              readOnly
              value={
                readiness.messagePreview.toMissing
                  ? "Missing recipient email"
                  : readiness.messagePreview.to
              }
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              aria-readonly="true"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Subject
            </span>
            <input
              type="text"
              value={subjectValue}
              onChange={(event) => setSubjectDraft(event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Body</span>
            <textarea
              value={bodyValue}
              onChange={(event) => setBodyDraft(event.target.value)}
              rows={8}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <p className="text-xs text-slate-500">
            Review your proposal here:
            <span className="ml-1 font-medium text-slate-700">{linkLabel}</span>
          </p>
        </div>
      </div>

      {prepErrorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {prepErrorMessage}
        </p>
      ) : null}

      {copyMessage ? <p className="text-sm text-emerald-700">{copyMessage}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {sessionCustomerLink ? (
          <>
            <button
              type="button"
              className={SEND_PRIMARY_ACTION}
              onClick={handleOpenCustomerProposal}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open customer proposal
            </button>
            <button
              type="button"
              className={SEND_SECONDARY_ACTION}
              onClick={() => void handleCopyCustomerSendLink()}
            >
              <Link2 className="h-4 w-4" aria-hidden />
              Copy customer send link
            </button>
          </>
        ) : (
          <button
            type="button"
            className={SEND_PRIMARY_ACTION}
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
        )}

        <button
          type="button"
          className={SEND_PRIMARY_ACTION}
          disabled
          aria-disabled="true"
          title={readiness.disabledReason}
        >
          Send proposal
        </button>
      </div>

      <div className="space-y-2 border-t border-slate-200/80 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Coming later
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {readiness.deferredActions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled
              aria-disabled="true"
              className={`${BUILDER_DISABLED_ACTION} w-full sm:w-auto`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
