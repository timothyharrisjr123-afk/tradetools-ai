"use client";

import { useCallback, useEffect, useState } from "react";
import { validateManualQuantityInput } from "@/app/lib/proposalScopeDecisionActions";
import { WORKBENCH_EDIT_OPTION_CONTROL_ENABLED } from "./proposalBuilderConstants";

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
};

/**
 * Block 4E — inline single-row quantity editor.
 * Uses applyManualQuantityScopeDecision via parent onSave — row-local only.
 */
export default function ProposalBuilderWorkbenchInlineQuantityEditor({
  line,
  inFlight,
  error,
  onCancel,
  onSave,
}: ProposalBuilderWorkbenchInlineQuantityEditorProps) {
  const [quantityDraft, setQuantityDraft] = useState("");
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  useEffect(() => {
    setQuantityDraft("");
    setLocalValidationError(null);
  }, [line.templateItemId]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !inFlight) onCancel();
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

  return (
    <div
      className="flex w-full flex-wrap items-center gap-2 rounded-md border border-blue-200/80 bg-blue-50/40 px-2.5 py-2"
      data-builder-inline-quantity-editor
      data-builder-inline-quantity-line={line.templateItemId}
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">
        {line.name}
      </span>
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
        className={`${WORKBENCH_EDIT_OPTION_CONTROL_ENABLED} !w-24 !py-1.5`}
        aria-label={`Quantity for ${line.name}`}
        data-builder-set-quantity-input
        onKeyDown={(event) => {
          if (event.key === "Enter" && !saveDisabled) {
            event.preventDefault();
            void handleSave();
          }
        }}
      />
      {line.unitLabel ? (
        <span className="shrink-0 text-[12px] font-medium text-slate-500">{line.unitLabel}</span>
      ) : null}
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
      >
        Cancel
      </button>
      {localValidationError || error ? (
        <p className="w-full text-[12px] text-red-600" role="alert">
          {localValidationError ?? error}
        </p>
      ) : null}
    </div>
  );
}
