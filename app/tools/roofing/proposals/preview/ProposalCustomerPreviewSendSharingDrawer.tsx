"use client";

import { useEffect, useState } from "react";
import { Clock3, Link2, Send, X } from "lucide-react";
import type { JobRecord } from "@/app/lib/jobTypes";
import type { ProposalCustomerPreviewReadiness } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import { resolveSendGateCustomerName } from "@/app/lib/proposalSendGateReadiness";
import ProposalCustomerPreviewCustomerRequestsSection from "./ProposalCustomerPreviewCustomerRequestsSection";
import ProposalCustomerPreviewDeliveryHistorySection from "./ProposalCustomerPreviewDeliveryHistorySection";
import ProposalCustomerPreviewPublicAccessPanel from "./ProposalCustomerPreviewPublicAccessPanel";
import ProposalCustomerPreviewSendGatePanel from "./ProposalCustomerPreviewSendGatePanel";

type ReviewTab = "send" | "link" | "activity";

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
  initialTab?: ReviewTab;
};

const TAB_CLASS =
  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold transition";

/**
 * Send / sharing drawer — closed by default.
 * Holds full send form, link tools, and delivery activity outside the default page.
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
  initialTab = "send",
}: ProposalCustomerPreviewSendSharingDrawerProps) {
  const [tab, setTab] = useState<ReviewTab>(initialTab);
  const customerName = resolveSendGateCustomerName(graph, job) ?? "Customer";

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

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
    <div className="fixed inset-0 z-50" data-preview-send-sharing-drawer>
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
        aria-label="Close send and sharing"
        data-preview-send-sharing-backdrop
        onClick={onClose}
      />
      <aside
        id="preview-send-sharing-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Send proposal"
        className="absolute inset-y-0 right-0 flex w-full max-w-[38rem] flex-col border-l border-slate-200/80 bg-[#f8fafc] shadow-[-18px_0_48px_rgba(15,23,42,0.16)]"
        data-preview-send-sharing-panel
      >
        <header className="shrink-0 border-b border-slate-200/80 bg-white px-6 pb-5 pt-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
                aria-hidden
              >
                <Send className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-slate-950">
                  Send proposal
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
                  <span className="font-medium text-slate-700">Draft</span>
                  <span className="text-slate-300" aria-hidden>·</span>
                  <span>Not sent</span>
                  <span className="text-slate-300" aria-hidden>·</span>
                  <span>
                    Customer: <strong className="font-semibold text-slate-700">{customerName}</strong>
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
              data-preview-send-sharing-close
              onClick={onClose}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div
          className="mx-6 mt-4 flex shrink-0 rounded-xl bg-slate-200/60 p-1 sm:mx-7"
          role="tablist"
          aria-label="Send and sharing"
          data-preview-review-tabs
        >
          {(
            [
              ["send", "Send", Send],
              ["link", "Link", Link2],
              ["activity", "Activity", Clock3],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`${TAB_CLASS} ${
                tab === id
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              data-preview-review-tab={id}
              onClick={() => setTab(id)}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-5 sm:px-7"
          data-preview-review-tab-panel
        >
          {tab === "send" ? (
            <div data-preview-tab-send>
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
              />
            </div>
          ) : null}

          {tab === "link" ? (
            <div data-preview-tab-link>
              <ProposalCustomerPreviewPublicAccessPanel
                jobId={jobId}
                proposalId={proposalId}
                proposal={graph.proposal}
                loading={false}
                hideDeferredActions
                embedded
              />
            </div>
          ) : null}

          {tab === "activity" ? (
            <div data-preview-tab-activity className="space-y-6">
              <ProposalCustomerPreviewCustomerRequestsSection
                jobId={jobId}
                proposalId={proposalId}
              />
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">
                    Recent delivery activity
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                    Email delivery history for this proposal.
                  </p>
                </div>
                <ProposalCustomerPreviewDeliveryHistorySection
                  jobId={jobId}
                  proposalId={proposalId}
                  refreshKey={0}
                />
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
