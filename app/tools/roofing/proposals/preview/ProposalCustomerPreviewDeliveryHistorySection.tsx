"use client";

import { useCallback, useEffect, useState } from "react";
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
};

function deliveryAttemptToneClass(
  tone: ProposalDeliveryAttemptListItemViewModel["statusTone"]
): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50/70";
    case "error":
      return "border-red-200 bg-red-50/70";
    case "pending":
      return "border-amber-200 bg-amber-50/70";
    case "warning":
      return "border-amber-200 bg-amber-50/70";
    default:
      return "border-slate-200 bg-white";
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

function DeliveryAttemptSummary({
  item,
  emphasized = false,
}: {
  item: ProposalDeliveryAttemptListItemViewModel;
  emphasized?: boolean;
}) {
  const timestamp = formatProposalDeliveryHistoryTimestamp(item.displayTimestamp);

  return (
    <div
      className={`space-y-2 rounded-md border px-4 py-3 ${deliveryAttemptToneClass(item.statusTone)} ${
        emphasized ? "shadow-sm" : ""
      }`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <p className={`text-sm font-semibold ${deliveryAttemptStatusClass(item.statusTone)}`}>
          {item.statusLabel}
        </p>
        {timestamp ? (
          <p className="text-xs text-slate-500">{timestamp}</p>
        ) : null}
      </div>
      <p className="text-sm text-slate-600">{item.shortExplanation}</p>
      {item.recipientDisplay ? (
        <p className="text-sm text-slate-600">
          To: <span className="font-medium text-slate-800">{item.recipientDisplay}</span>
        </p>
      ) : null}
      <p className="text-sm text-slate-600">
        Subject: <span className="font-medium text-slate-800">{item.subject}</span>
      </p>
      {item.bodyPreview ? (
        <p className="text-sm text-slate-500">{item.bodyPreview}</p>
      ) : null}
      {item.supportLinkPrefix ? (
        <p className="text-xs text-slate-400">Support ref: {item.supportLinkPrefix}</p>
      ) : null}
    </div>
  );
}

export default function ProposalCustomerPreviewDeliveryHistorySection({
  proposalId,
  jobId,
  refreshKey = 0,
}: ProposalCustomerPreviewDeliveryHistorySectionProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<ProposalDeliveryHistoryViewModel | null>(null);

  const loadHistory = useCallback(async () => {
    if (!proposalId.trim() || !jobId.trim()) {
      setLoading(false);
      setHistory(null);
      setErrorMessage(SEND_GATE_DELIVERY_HISTORY_ERROR_MESSAGE);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const result = await fetchProposalDeliveryHistory({ proposalId, jobId });

    if (!result.ok) {
      setHistory(null);
      setErrorMessage(SEND_GATE_DELIVERY_HISTORY_ERROR_MESSAGE);
      setLoading(false);
      return;
    }

    setHistory(result.history);
    setLoading(false);
  }, [jobId, proposalId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  const earlierAttempts = history ? getProposalDeliveryHistoryEarlierAttempts(history) : [];

  return (
    <div className="space-y-3 border-t border-slate-200/80 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">
        {SEND_GATE_DELIVERY_HISTORY_SECTION_TITLE}
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {SEND_GATE_DELIVERY_HISTORY_LOADING_MESSAGE}
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errorMessage}
        </p>
      ) : null}

      {!loading && !errorMessage && history?.isEmpty ? (
        <div className="space-y-1 rounded-md border border-slate-200/80 bg-white px-4 py-3">
          <p className="text-sm font-medium text-slate-900">{history.emptyStateTitle}</p>
          <p className="text-sm text-slate-600">{history.emptyStateExplanation}</p>
        </div>
      ) : null}

      {!loading && !errorMessage && history && !history.isEmpty && history.latest ? (
        <div className="space-y-3">
          <DeliveryAttemptSummary item={history.latest} emphasized />
          {earlierAttempts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {SEND_GATE_DELIVERY_HISTORY_EARLIER_ATTEMPTS_LABEL}
              </p>
              <div className="space-y-2">
                {earlierAttempts.map((item, index) => (
                  <DeliveryAttemptSummary
                    key={`${item.displayTimestamp ?? item.createdAt ?? "attempt"}-${item.subject}-${index}`}
                    item={item}
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
