"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { validateManualQuantityInput } from "@/app/lib/proposalScopeDecisionActions";
import {
  WORKBENCH_EDIT_OPTION_CANCEL_BTN,
  WORKBENCH_EDIT_OPTION_CONTROL_ENABLED,
  WORKBENCH_EDIT_OPTION_DRAWER_BACKDROP,
  WORKBENCH_EDIT_OPTION_SAVE_BTN,
} from "./proposalBuilderConstants";

export type SetQuantityLine = {
  templateItemId: string;
  name: string;
  unitLabel: string | null;
};

type ProposalBuilderWorkbenchSetQuantityPanelProps = {
  line: SetQuantityLine;
  inFlight: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
};

/**
 * Block 4D — focused item-level quantity editor.
 * Uses the same manual-quantity persistence path as Edit package, without the
 * full package-scope line list.
 */
export default function ProposalBuilderWorkbenchSetQuantityPanel({
  line,
  inFlight,
  error,
  onClose,
  onSave,
}: ProposalBuilderWorkbenchSetQuantityPanelProps) {
  const [quantityDraft, setQuantityDraft] = useState("");
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  useEffect(() => {
    setQuantityDraft("");
    setLocalValidationError(null);
  }, [line.templateItemId]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !inFlight) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [inFlight, onClose]);

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className={WORKBENCH_EDIT_OPTION_DRAWER_BACKDROP}
        aria-hidden="true"
        onClick={() => {
          if (!inFlight) onClose();
        }}
      />
      <aside
        className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-set-quantity-title"
        data-builder-set-quantity-panel
        data-builder-set-quantity-line={line.templateItemId}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Quantity
            </p>
            <h3
              className="mt-0.5 text-base font-semibold text-slate-950"
              id="builder-set-quantity-title"
            >
              Set quantity
            </h3>
            <p className="mt-1 truncate text-[13px] font-medium text-slate-700">{line.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={inFlight}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            aria-label="Close set quantity"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex-1 px-5 py-4">
          <label
            htmlFor="builder-set-quantity-input"
            className="text-[12px] font-medium text-slate-700"
          >
            Quantity for {line.name}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="builder-set-quantity-input"
              type="text"
              inputMode="decimal"
              autoFocus
              value={quantityDraft}
              onChange={(event) => {
                setQuantityDraft(event.target.value);
                setLocalValidationError(null);
              }}
              disabled={inFlight}
              placeholder="Enter quantity"
              className={WORKBENCH_EDIT_OPTION_CONTROL_ENABLED}
              aria-invalid={Boolean(localValidationError || error)}
              data-builder-set-quantity-input
            />
            {line.unitLabel ? (
              <span className="shrink-0 text-[12px] font-medium text-slate-500">
                {line.unitLabel}
              </span>
            ) : null}
          </div>
          {localValidationError ? (
            <p className="mt-1.5 text-[12px] text-red-600" role="alert">
              {localValidationError}
            </p>
          ) : null}
          {error ? (
            <p className="mt-1.5 text-[12px] text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <p className="mt-3 text-[12px] leading-snug text-slate-500">
            Saves to this proposal draft and refreshes pricing for this line.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={inFlight}
            className={WORKBENCH_EDIT_OPTION_CANCEL_BTN}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveDisabled}
            className={WORKBENCH_EDIT_OPTION_SAVE_BTN}
            data-builder-set-quantity-save
          >
            {inFlight ? "Saving…" : "Save quantity"}
          </button>
        </footer>
      </aside>
    </>,
    document.body
  );
}
