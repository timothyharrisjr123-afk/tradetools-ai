"use client";

import { useMemo, useState } from "react";
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
  SEND_GATE_DELIVERY_DISABLED_MESSAGE,
  SEND_GATE_PANEL_TITLE,
  type SendGateChecklistStatus,
} from "@/app/lib/proposalSendGateReadiness";
import { BUILDER_CARD, BUILDER_DISABLED_ACTION } from "../builder/proposalBuilderConstants";

type ProposalCustomerPreviewSendGatePanelProps = {
  graph: ProposalDraftGraph | null;
  job: JobRecord | null;
  previewReadiness: ProposalCustomerPreviewReadiness | null;
  pricingStale?: boolean;
  loading: boolean;
};

const SEND_PRIMARY_ACTION =
  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-300 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto";

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
  graph,
  job,
  previewReadiness,
  pricingStale = false,
  loading,
}: ProposalCustomerPreviewSendGatePanelProps) {
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
      job,
      loading,
      previewReadiness,
      pricingStale,
      recipientEmail,
      sendFreezeReadiness,
      projectAddress,
    ]
  );

  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);

  const subjectValue = subjectDraft ?? readiness.messagePreview.subject;
  const bodyValue = bodyDraft ?? readiness.messagePreview.body;

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
            Public proposal link: {readiness.messagePreview.linkLabel}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
