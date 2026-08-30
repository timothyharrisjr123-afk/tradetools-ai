"use client";

import { Send } from "lucide-react";
import { CUSTOMER_PREVIEW_SEND_LABEL } from "@/app/lib/proposalBuilderDocumentIa";

type ProposalPreviewActionGroupProps = {
  onSendSharing: () => void;
  showSendSharing: boolean;
};

const SEND_ACTION =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:min-h-10";

/**
 * V2C1 — Preview primary action only (draft Send).
 * PDF download lives on sent-record Preview only — never here.
 */
export default function ProposalPreviewActionGroup({
  onSendSharing,
  showSendSharing,
}: ProposalPreviewActionGroupProps) {
  if (!showSendSharing) return null;

  return (
    <div
      className="flex shrink-0 items-center"
      data-preview-action-group
      aria-label="Proposal actions"
    >
      <button
        type="button"
        className={SEND_ACTION}
        data-preview-send-sharing-toggle
        data-preview-send-cta
        onClick={onSendSharing}
      >
        <Send className="h-4 w-4" aria-hidden />
        {CUSTOMER_PREVIEW_SEND_LABEL}
      </button>
    </div>
  );
}
