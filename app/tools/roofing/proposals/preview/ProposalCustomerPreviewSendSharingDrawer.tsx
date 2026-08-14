"use client";

import { useEffect } from "react";
import { Send, X } from "lucide-react";
import type { JobRecord } from "@/app/lib/jobTypes";
import type { ProposalCustomerPreviewReadiness } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import type { ProposalPreviewSentFrozenChrome } from "@/app/lib/proposalPreviewSentFrozenChrome";
import { resolveSendGateCustomerName } from "@/app/lib/proposalSendGateReadiness";
import ProposalCustomerPreviewSendGatePanel from "./ProposalCustomerPreviewSendGatePanel";

type ProposalCustomerPreviewSendSharingDrawerProps = {
  open: boolean;
  onClose: () => void;
  jobId: string;
  proposalId: string;
  graph: ProposalDraftGraph;
  job: JobRecord | null;
  previewReadiness: ProposalCustomerPreviewReadiness;
  pricingStale: boolean;
  emailDeliveryConfigured: boolean;
  companyLogoMissing?: boolean;
  builderHref: string;
  sentFrozenChrome: ProposalPreviewSentFrozenChrome;
  onSendCompleted?: () => void;
  /** @deprecated V2C2 — focused Send sheet has no peer tabs. Kept for call-site compat. */
  initialTab?: "send" | "link" | "activity";
};

/**
 * V2C2/V2C4 — Focused Send sheet.
 * Context line mirrors Preview sent/frozen chrome (draft document + last-sent awareness).
 */
export default function ProposalCustomerPreviewSendSharingDrawer({
  open,
  onClose,
  jobId,
  proposalId,
  graph,
  job,
  previewReadiness,
  pricingStale,
  emailDeliveryConfigured,
  companyLogoMissing = false,
  builderHref,
  sentFrozenChrome,
  onSendCompleted,
}: ProposalCustomerPreviewSendSharingDrawerProps) {
  const customerName = resolveSendGateCustomerName(graph, job) ?? "Customer";

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50" data-preview-send-sharing-drawer data-preview-send-sheet-v2c2>
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
        aria-label="Close send"
        data-preview-send-sharing-backdrop
        onClick={onClose}
      />
      <aside
        id="preview-send-sharing-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Send proposal"
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-slate-200/80 bg-[#f8fafc] shadow-[0_-18px_48px_rgba(15,23,42,0.18)] sm:inset-y-0 sm:bottom-auto sm:right-0 sm:left-auto sm:max-h-none sm:max-w-[28rem] sm:rounded-none sm:border-l sm:shadow-[-18px_0_48px_rgba(15,23,42,0.16)]"
        data-preview-send-sharing-panel
      >
        <header className="shrink-0 border-b border-slate-200/80 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
                aria-hidden
              >
                <Send className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[1.125rem] font-semibold tracking-[-0.02em] text-slate-950">
                  Send proposal
                </h2>
                <p
                  className="mt-1 truncate text-[13px] text-slate-500"
                  data-preview-send-sheet-context
                  data-preview-sent-frozen-kind={sentFrozenChrome.kind}
                >
                  <span className="font-medium text-slate-700" data-preview-draft-status>
                    {sentFrozenChrome.statusLabel}
                  </span>
                  <span className="text-slate-300" aria-hidden>
                    {" "}
                    ·{" "}
                  </span>
                  <span>
                    Customer:{" "}
                    <strong className="font-semibold text-slate-700">{customerName}</strong>
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:min-h-9 sm:min-w-9"
              aria-label="Close"
              data-preview-send-sharing-close
              onClick={onClose}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-7 pt-4 sm:px-6" data-preview-tab-send>
          <ProposalCustomerPreviewSendGatePanel
            jobId={jobId}
            proposalId={proposalId}
            graph={graph}
            job={job}
            previewReadiness={previewReadiness}
            pricingStale={pricingStale}
            loading={false}
            emailDeliveryConfigured={emailDeliveryConfigured}
            companyLogoMissing={companyLogoMissing}
            builderHref={builderHref}
            hideDeferredActions
            embedded
            onSendCompleted={onSendCompleted}
          />
        </div>
      </aside>
    </div>
  );
}
