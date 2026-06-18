"use client";

import { useMemo } from "react";
import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import {
  proposalDocumentBodyContractorNotice,
  renderProposalDocumentPageBody,
} from "@/app/lib/proposalDocumentBodyRenderer";
import {
  BUILDER_PAGE_EDIT_HELPER_COPY,
  BUILDER_PAGE_EDIT_MERGE_PREVIEW_LABEL,
} from "./proposalBuilderConstants";

type ProposalBuilderPageEditorProps = {
  draftBody: string;
  onDraftBodyChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  saveInFlight?: boolean;
  saveError?: string | null;
  proposalDocumentContext?: ProposalDocumentContext | null;
  pricingComplete?: boolean;
  /** Future token picker seam — not wired in R16B. */
  onInsertToken?: (tokenName: string) => void;
};

export default function ProposalBuilderPageEditor({
  draftBody,
  onDraftBodyChange,
  onSave,
  onCancel,
  saveDisabled = false,
  saveInFlight = false,
  saveError = null,
  proposalDocumentContext = null,
  pricingComplete = false,
}: ProposalBuilderPageEditorProps) {
  const mergePreview = useMemo(() => {
    if (!proposalDocumentContext) return null;
    const trimmed = draftBody.trim();
    if (!trimmed) return null;
    return renderProposalDocumentPageBody(trimmed, proposalDocumentContext, {
      pricingComplete,
    });
  }, [draftBody, proposalDocumentContext, pricingComplete]);

  const contractorNotice =
    mergePreview != null
      ? proposalDocumentBodyContractorNotice(mergePreview.diagnostics)
      : null;

  return (
    <div className="space-y-4 px-7 pb-7 pt-2">
      <p className="text-xs text-slate-500">{BUILDER_PAGE_EDIT_HELPER_COPY}</p>

      <textarea
        value={draftBody}
        onChange={(event) => onDraftBodyChange(event.target.value)}
        rows={14}
        className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        aria-label="Proposal page body text"
        spellCheck
      />

      {mergePreview ? (
        <div className="rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {BUILDER_PAGE_EDIT_MERGE_PREVIEW_LABEL}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {mergePreview.displayText}
          </p>
          {contractorNotice ? (
            <p className="mt-2 text-[11px] leading-snug text-slate-400">{contractorNotice}</p>
          ) : null}
        </div>
      ) : null}

      {saveError ? (
        <p className="text-sm text-red-700" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled || saveInFlight}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveInFlight ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saveInFlight}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
