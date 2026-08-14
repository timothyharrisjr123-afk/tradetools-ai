"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ProposalDeliveryAttemptListItemViewModel } from "@/app/lib/proposalDeliveryAttemptViewModel";
import type { ProposalDeliveryHistoryViewModel } from "@/app/lib/proposalDeliveryAttemptViewModel";
import {
  fetchProposalDeliveryHistory,
  formatProposalDeliveryHistoryTimestamp,
  getProposalDeliveryHistoryEarlierAttempts,
  SEND_GATE_DELIVERY_HISTORY_EARLIER_ATTEMPTS_LABEL,
  SEND_GATE_DELIVERY_HISTORY_ERROR_MESSAGE,
  SEND_GATE_DELIVERY_HISTORY_LOADING_MESSAGE,
  SEND_GATE_DELIVERY_HISTORY_SECTION_TITLE,
} from "@/app/lib/proposalDeliveryHistoryClient";

type ProposalCustomerPreviewDeliveryHistorySectionProps = {
  proposalId: string;
  jobId: string;
  refreshKey?: number;
  /**
   * V2C3 — When embedded under quiet Delivery activity details,
   * drop the duplicate section title and use compact attempt rows.
   */
  embedded?: boolean;
  /** Optional compact summary for the parent details label (existing status copy only). */
  onSummaryChange?: (summary: string | null) => void;
};

function deliveryAttemptToneClass(
  tone: ProposalDeliveryAttemptListItemViewModel["statusTone"]
): string {
  switch (tone) {
    case "success":
      return "border-emerald-200/80 bg-emerald-50/60";
    case "error":
      return "border-red-200/80 bg-red-50/60";
    case "pending":
      return "border-amber-200/80 bg-amber-50/60";
    case "warning":
      return "border-amber-200/80 bg-amber-50/60";
    default:
      return "border-slate-200/80 bg-white";
  }
}

function deliveryAttemptStatusClass(
  tone: ProposalDeliveryAttemptListItemViewModel["statusTone"]
): string {
  switch (tone) {
    case "success":
      return "text-emerald-800";
    case "error":
      return "text-red-800";
    case "pending":
      return "text-amber-900";
    case "warning":
      return "text-amber-900";
    default:
      return "text-slate-700";
  }
}

function buildDeliveryActivitySummary(
  item: ProposalDeliveryAttemptListItemViewModel
): string {
  const timestamp = formatProposalDeliveryHistoryTimestamp(item.displayTimestamp);
  return timestamp ? `${item.statusLabel} · ${timestamp}` : item.statusLabel;
}

function DeliveryAttemptSummary({
  item,
  compact = false,
}: {
  item: ProposalDeliveryAttemptListItemViewModel;
  compact?: boolean;
}) {
  const timestamp = formatProposalDeliveryHistoryTimestamp(item.displayTimestamp);
  const showErrorContext =
    item.statusTone === "error" || item.statusTone === "warning";

  return (
    <div
      className={`rounded-lg border px-3.5 py-3 ${deliveryAttemptToneClass(item.statusTone)}`}
      data-preview-delivery-attempt
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <p className={`text-[13px] font-semibold ${deliveryAttemptStatusClass(item.statusTone)}`}>
          {item.statusLabel}
        </p>
        {timestamp ? (
          <p className="text-[12px] text-slate-500">{timestamp}</p>
        ) : null}
      </div>
      {item.recipientDisplay ? (
        <p className="mt-1.5 text-[12.5px] text-slate-600">
          To: <span className="font-medium text-slate-800">{item.recipientDisplay}</span>
        </p>
      ) : null}
      {showErrorContext ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
          {item.shortExplanation}
        </p>
      ) : null}
      {!compact && item.subject ? (
        <p className="mt-1.5 text-[12.5px] text-slate-600">
          Subject: <span className="font-medium text-slate-800">{item.subject}</span>
        </p>
      ) : null}
      {!compact && item.bodyPreview ? (
        <p className="mt-1 text-[12.5px] text-slate-500">{item.bodyPreview}</p>
      ) : null}
      {!compact && item.supportLinkPrefix ? (
        <p className="mt-1 text-[11px] text-slate-400">Support ref: {item.supportLinkPrefix}</p>
      ) : null}
    </div>
  );
}

export default function ProposalCustomerPreviewDeliveryHistorySection({
  proposalId,
  jobId,
  refreshKey = 0,
  embedded = false,
  onSummaryChange,
}: ProposalCustomerPreviewDeliveryHistorySectionProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<ProposalDeliveryHistoryViewModel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!proposalId.trim() || !jobId.trim()) {
        await Promise.resolve();
        if (cancelled) return;
        setLoading(false);
        setHistory(null);
        setErrorMessage(SEND_GATE_DELIVERY_HISTORY_ERROR_MESSAGE);
        onSummaryChange?.(null);
        return;
      }

      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setErrorMessage(null);

      const result = await fetchProposalDeliveryHistory({ proposalId, jobId });
      if (cancelled) return;

      if (!result.ok) {
        setHistory(null);
        setErrorMessage(SEND_GATE_DELIVERY_HISTORY_ERROR_MESSAGE);
        setLoading(false);
        onSummaryChange?.(null);
        return;
      }

      setHistory(result.history);
      setLoading(false);
      if (result.history.latest) {
        onSummaryChange?.(buildDeliveryActivitySummary(result.history.latest));
      } else {
        onSummaryChange?.(null);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [jobId, onSummaryChange, proposalId, refreshKey]);

  const earlierAttempts = history ? getProposalDeliveryHistoryEarlierAttempts(history) : [];

  return (
    <div
      className={embedded ? "space-y-2.5" : "space-y-3 border-t border-slate-200/70 pt-5"}
      data-preview-delivery-history
      data-preview-delivery-history-v2c3={embedded ? "embedded" : "standalone"}
    >
      {!embedded ? (
        <h3 className="text-[13px] font-semibold text-slate-700">
          {SEND_GATE_DELIVERY_HISTORY_SECTION_TITLE}
        </h3>
      ) : (
        <p className="sr-only">{SEND_GATE_DELIVERY_HISTORY_SECTION_TITLE}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {SEND_GATE_DELIVERY_HISTORY_LOADING_MESSAGE}
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-[13px] text-amber-900">
          {errorMessage}
        </p>
      ) : null}

      {!loading && !errorMessage && history?.isEmpty ? (
        <p
          className="text-[13px] text-slate-500"
          data-preview-delivery-history-empty
        >
          {history.emptyStateTitle}
        </p>
      ) : null}

      {!loading && !errorMessage && history && !history.isEmpty && history.latest ? (
        <div className="space-y-2.5" data-preview-delivery-history-list>
          <DeliveryAttemptSummary item={history.latest} compact={embedded} />
          {earlierAttempts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {SEND_GATE_DELIVERY_HISTORY_EARLIER_ATTEMPTS_LABEL}
              </p>
              <div className="space-y-2">
                {earlierAttempts.map((item, index) => (
                  <DeliveryAttemptSummary
                    key={`${item.displayTimestamp ?? item.createdAt ?? "attempt"}-${item.subject}-${index}`}
                    item={item}
                    compact={embedded}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
