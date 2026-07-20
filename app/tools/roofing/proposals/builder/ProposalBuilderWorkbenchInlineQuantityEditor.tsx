"use client";

import { useCallback, useEffect, useState } from "react";
import { validateManualQuantityInput } from "@/app/lib/proposalScopeDecisionActions";
import { WORKBENCH_INCLUDED_ROW_GRID } from "./proposalBuilderConstants";

export type InlineQuantityLine = {
  templateItemId: string;
  name: string;
  unitLabel: string | null;
};

type ProposalBuilderWorkbenchInlineQuantityEditorProps = {
  line: InlineQuantityLine;
  inFlight: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
  /** Use included-estimate column grid when editing in the table. */
  alignToColumns?: boolean;
};

/**
 * Inline single-row quantity editor.
 * Enter saves · Escape cancels · one editor open (parent-owned state).
 */
export default function ProposalBuilderWorkbenchInlineQuantityEditor({
  line,
  inFlight,
  error,
  onCancel,
  onSave,
  alignToColumns = false,
}: ProposalBuilderWorkbenchInlineQuantityEditorProps) {
  const [quantityDraft, setQuantityDraft] = useState("");
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  useEffect(() => {
    setQuantityDraft("");
    setLocalValidationError(null);
  }, [line.templateItemId]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || inFlight) return;
      event.preventDefault();
      onCancel();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [inFlight, onCancel]);

  const handleSave = useCallback(async () => {
    if (inFlight) return;
    const validation = validateManualQuantityInput(quantityDraft);
    if (!validation.ok) {
      setLocalValidationError(validation.message);
      return;
    }
    setLocalValidationError(null);
    const unit = line.unitLabel?.trim();
    const displayLabel = unit ? `${validation.quantity} ${unit}` : String(validation.quantity);
    await onSave(line.templateItemId, quantityDraft, displayLabel);
  }, [inFlight, line.templateItemId, line.unitLabel, onSave, quantityDraft]);

  const saveDisabled =
    inFlight ||
    quantityDraft.trim().length === 0 ||
    !validateManualQuantityInput(quantityDraft).ok;

  const qtyInput = (
    <input
      type="text"
      inputMode="decimal"
      autoFocus
      value={quantityDraft}
      onChange={(event) => {
        setQuantityDraft(event.target.value);
        setLocalValidationError(null);
      }}
      disabled={inFlight}
      placeholder="Qty"
      className="w-full max-w-[7.5rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-[13px] tabular-nums text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-50"
      aria-label={`Quantity for ${line.name}`}
      data-builder-set-quantity-input
      onKeyDown={(event) => {
        if (event.key === "Enter" && !saveDisabled) {
          event.preventDefault();
          void handleSave();
        }
      }}
    />
  );

  const unitLabel = line.unitLabel ? (
    <span
      className="text-[12px] font-medium text-slate-500"
      data-builder-inline-quantity-unit
    >
      {line.unitLabel}
    </span>
  ) : null;

  const saveCancel = (
    <>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saveDisabled}
        className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        data-builder-set-quantity-save
      >
        {inFlight ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={inFlight}
        className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        data-builder-set-quantity-cancel
      >
        Cancel
      </button>
    </>
  );

  return (
    <div
      className="rounded-md border border-blue-200/80 bg-blue-50/40 px-2 py-2"
      data-builder-inline-quantity-editor
      data-builder-inline-quantity-line={line.templateItemId}
    >
      {alignToColumns ? (
        <div className={WORKBENCH_INCLUDED_ROW_GRID}>
          <p className="min-w-0 truncate text-[13px] font-medium text-slate-900">{line.name}</p>
          <div className="flex flex-col items-end gap-0.5">
            {qtyInput}
            {unitLabel}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">{saveCancel}</div>
          <span className="hidden sm:block" aria-hidden />
        </div>
      ) : (
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">
            {line.name}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {qtyInput}
            {unitLabel}
            {saveCancel}
          </div>
        </div>
      )}
      {localValidationError || error ? (
        <p className="mt-1.5 text-[12px] text-red-600" role="alert">
          {localValidationError ?? error}
        </p>
      ) : null}
    </div>
  );
}
