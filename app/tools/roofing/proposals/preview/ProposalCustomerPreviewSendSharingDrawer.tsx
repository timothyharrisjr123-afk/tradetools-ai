"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { JobRecord } from "@/app/lib/jobTypes";
import type { ProposalCustomerPreviewReadiness } from "@/app/lib/proposalCustomerPreviewViewModel";
import { CUSTOMER_PREVIEW_SEND_SHARING_LABEL } from "@/app/lib/proposalBuilderDocumentIa";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import ProposalCustomerPreviewPublicAccessPanel from "./ProposalCustomerPreviewPublicAccessPanel";
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
};

/**
 * Block 5 Roofr-first — Send / sharing as a side drawer, closed by default.
 * Not part of the customer document; does not stack under the proposal as an admin page.
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
}: ProposalCustomerPreviewSendSharingDrawerProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
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
    <div className="fixed inset-0 z-50" data-preview-send-sharing-drawer>
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40"
        aria-label="Close send and sharing"
        onClick={onClose}
      />
      <aside
        id="preview-send-sharing-panel"
        role="dialog"
        aria-modal="true"
        aria-label={CUSTOMER_PREVIEW_SEND_SHARING_LABEL}
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl"
        data-preview-send-sharing-panel
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {CUSTOMER_PREVIEW_SEND_SHARING_LABEL}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Sharing and sending controls. These are not part of what the customer sees.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <ProposalCustomerPreviewPublicAccessPanel
            jobId={jobId}
            proposalId={proposalId}
            proposal={graph.proposal}
            loading={false}
            hideDeferredActions
          />

          <ProposalCustomerPreviewSendGatePanel
            jobId={jobId}
            proposalId={proposalId}
            graph={graph}
            job={job}
            previewReadiness={previewReadiness}
            pricingStale={pricingStale}
            loading={false}
            emailDeliveryConfigured={emailDeliveryConfigured}
            hideDeferredActions
          />
        </div>
      </aside>
    </div>
  );
}
