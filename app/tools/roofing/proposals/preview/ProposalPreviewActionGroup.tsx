"use client";

import { Download, PenLine, Send } from "lucide-react";
import { CUSTOMER_PREVIEW_SEND_SHARING_LABEL } from "@/app/lib/proposalBuilderDocumentIa";

type ProposalPreviewActionGroupProps = {
  onSendSharing: () => void;
  showSendSharing: boolean;
};

const SECONDARY_ACTION =
  "inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold text-slate-400";

const SEND_ACTION =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700";

/**
 * Compact Preview + Send action group.
 * Unsupported actions are deliberately disabled and do not mount workflows.
 */
export default function ProposalPreviewActionGroup({
  onSendSharing,
  showSendSharing,
}: ProposalPreviewActionGroupProps) {
  if (!showSendSharing) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-preview-action-group
      aria-label="Proposal actions"
    >
      <button
        type="button"
        className={SECONDARY_ACTION}
        disabled
        aria-disabled="true"
        title="Coming later"
        data-preview-future-action="sign-in-person"
      >
        <PenLine className="h-4 w-4" aria-hidden />
        <span>Sign in person</span>
      </button>
      <button
        type="button"
        className={SECONDARY_ACTION}
        disabled
        aria-disabled="true"
        title="Coming later"
        data-preview-future-action="download-pdf"
      >
        <Download className="h-4 w-4" aria-hidden />
        <span>Download PDF</span>
      </button>
      <button
        type="button"
        className={SEND_ACTION}
        data-preview-send-sharing-toggle
        onClick={onSendSharing}
      >
        <Send className="h-4 w-4" aria-hidden />
        {CUSTOMER_PREVIEW_SEND_SHARING_LABEL}
      </button>
    </div>
  );
}
