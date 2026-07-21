"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { validateManualQuantityInput } from "@/app/lib/proposalScopeDecisionActions";
import {
  WORKBENCH_EDIT_OPTION_CONTROL_ENABLED,
  WORKBENCH_EDIT_OPTION_DRAWER_BACKDROP,
  WORKBENCH_EDIT_OPTION_DRAWER_BODY,
  WORKBENCH_EDIT_OPTION_DRAWER_FOOTER,
  WORKBENCH_EDIT_OPTION_DRAWER_HEADER,
  WORKBENCH_EDIT_OPTION_DRAWER_PANEL,
  WORKBENCH_EDIT_OPTION_INTRO_COPY,
  WORKBENCH_EDIT_OPTION_INTRO_COPY_LIVE,
  WORKBENCH_EDIT_OPTION_SAVE_BTN,
  WORKBENCH_EDIT_OPTION_TRUST_COPY,
  WORKBENCH_EDIT_OPTION_USE_MEASUREMENT_BTN,
  WORKBENCH_EDIT_PACKAGE_TITLE,
  WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL,
  WORKBENCH_MANUAL_QUANTITY_RESET_HELPER,
  WORKBENCH_EXCLUDE_ACTION_BTN,
  WORKBENCH_EXCLUDE_ACTION_LABEL,
  WORKBENCH_EXCLUDE_HELPER_COPY,
  WORKBENCH_EXCLUDE_IN_FLIGHT_LABEL,
  WORKBENCH_MODULE_TITLE,
} from "./proposalBuilderConstants";

export type ManualQuantityEditorLine = {
  templateItemId: string;
  name: string;
  unitLabel: string | null;
};

export type ExcludeEditorLine = {
  templateItemId: string;
  name: string;
};

export type HideEditorLine = {
  templateItemId: string;
  name: string;
};

export type EditOptionDrawerIntent = "quantity" | "exclude" | "visibility";

export type ManualQuantityActiveLine = {
  templateItemId: string;
  name: string;
  unitLabel: string | null;
  quantityDisplayLabel: string;
};

const FUTURE_PACKAGE_TOOLS = [
  {
    id: "catalog",
    title: "Add from catalog",
    description: "Pull additional catalog items into this package.",
  },
  {
    id: "custom",
    title: "Add custom line",
    description: "Add a one-off line for this job only.",
  },
  {
    id: "upgrade",
    title: "Move to optional upgrade",
    description: "Reclassify a line as an optional upgrade.",
  },
  {
    id: "quantity_source",
    title: "Quantity source mapping",
    description: "Choose which measurement drives quantity.",
  },
] as const;

export type ProposalBuilderWorkbenchEditOptionShellProps = {
  open: boolean;
  onClose: () => void;
  optionLabel: string | null;
  scopeReviewCount: number;
  scopeReviewLines: ManualQuantityEditorLine[];
  excludeEligibleLines: ExcludeEditorLine[];
  hideEligibleLines: HideEditorLine[];
  manualActiveLines: ManualQuantityActiveLine[];
  focusedTemplateItemId: string | null;
  drawerIntent: EditOptionDrawerIntent;
  /** Pass a line id to open/switch; pass null to collapse the open accordion row. */
  onFocusTemplateItemId: (templateItemId: string | null) => void;
  persistedDraftEnabled: boolean;
  scopeEditInFlight: boolean;
  manualQuantityError: string | null;
  excludeError: string | null;
  visibilityError: string | null;
  onApplyManualQuantity: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
  onClearManualQuantity: (templateItemId: string) => Promise<void>;
  onExcludeLine: (templateItemId: string) => Promise<void>;
  onHideLine: (templateItemId: string) => Promise<void>;
};

type ReviewLineRow = {
  templateItemId: string;
  name: string;
  kind: "scope_review" | "manual_active";
  unitLabel: string | null;
  quantityDisplayLabel: string | null;
};

export default function ProposalBuilderWorkbenchEditOptionShell({
  open,
  onClose,
  optionLabel,
  scopeReviewCount,
  scopeReviewLines,
  excludeEligibleLines,
  hideEligibleLines,
  manualActiveLines,
  focusedTemplateItemId,
  drawerIntent,
  onFocusTemplateItemId,
  persistedDraftEnabled,
  scopeEditInFlight,
  manualQuantityError,
  excludeError,
  visibilityError,
  onApplyManualQuantity,
  onClearManualQuantity,
  onExcludeLine,
  onHideLine,
}: ProposalBuilderWorkbenchEditOptionShellProps) {
  const [quantityDraft, setQuantityDraft] = useState("");
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);
  const [futureOpen, setFutureOpen] = useState(false);

  const activeScopeReviewLine = useMemo(() => {
    if (!focusedTemplateItemId) return null;
    return scopeReviewLines.find((line) => line.templateItemId === focusedTemplateItemId) ?? null;
  }, [focusedTemplateItemId, scopeReviewLines]);

  const activeManualLine = useMemo(() => {
    if (!focusedTemplateItemId) return null;
    return manualActiveLines.find((line) => line.templateItemId === focusedTemplateItemId) ?? null;
  }, [focusedTemplateItemId, manualActiveLines]);

  const activeExcludeLine = useMemo(() => {
    if (!focusedTemplateItemId) return null;
    return excludeEligibleLines.find((line) => line.templateItemId === focusedTemplateItemId) ?? null;
  }, [excludeEligibleLines, focusedTemplateItemId]);

  const showLiveQuantity =
    persistedDraftEnabled && (scopeReviewLines.length > 0 || manualActiveLines.length > 0);
  const showLiveExclude = persistedDraftEnabled && excludeEligibleLines.length > 0;
  // Block 4: hide/visibility UI is not surfaced on the estimate review path.
  void hideEligibleLines;
  void onHideLine;
  void visibilityError;

  const activeQuantityLine = activeScopeReviewLine ?? activeManualLine;
  const activeManualQuantityValue = useMemo(() => {
    const label = activeManualLine?.quantityDisplayLabel.trim() ?? "";
    return label.match(/^-?\d+(?:\.\d+)?/)?.[0] ?? "";
  }, [activeManualLine]);

  const reviewLines = useMemo(() => {
    const seen = new Set<string>();
    const rows: ReviewLineRow[] = [];
    for (const line of scopeReviewLines) {
      if (seen.has(line.templateItemId)) continue;
      seen.add(line.templateItemId);
      rows.push({
        templateItemId: line.templateItemId,
        name: line.name,
        kind: "scope_review",
        unitLabel: line.unitLabel,
        quantityDisplayLabel: null,
      });
    }
    for (const line of manualActiveLines) {
      if (seen.has(line.templateItemId)) continue;
      seen.add(line.templateItemId);
      rows.push({
        templateItemId: line.templateItemId,
        name: line.name,
        kind: "manual_active",
        unitLabel: line.unitLabel,
        quantityDisplayLabel: line.quantityDisplayLabel,
      });
    }
    return rows;
  }, [manualActiveLines, scopeReviewLines]);

  useEffect(() => {
    if (!open) {
      setQuantityDraft("");
      setLocalValidationError(null);
      setFutureOpen(false);
    }
  }, [open]);

  useEffect(() => {
    setQuantityDraft(activeManualQuantityValue);
    setLocalValidationError(null);
  }, [activeManualQuantityValue, focusedTemplateItemId]);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !scopeEditInFlight) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, scopeEditInFlight]);

  const handleSave = useCallback(async () => {
    if (!activeQuantityLine || scopeEditInFlight) return;

    const validation = validateManualQuantityInput(quantityDraft);
    if (!validation.ok) {
      setLocalValidationError(validation.message);
      return;
    }

    setLocalValidationError(null);
    const unit = activeQuantityLine.unitLabel?.trim();
    const displayLabel = unit ? `${validation.quantity} ${unit}` : String(validation.quantity);
    await onApplyManualQuantity(activeQuantityLine.templateItemId, quantityDraft, displayLabel);
  }, [activeQuantityLine, scopeEditInFlight, onApplyManualQuantity, quantityDraft]);

  const handleClear = useCallback(async () => {
    if (!activeManualLine || scopeEditInFlight) return;
    await onClearManualQuantity(activeManualLine.templateItemId);
  }, [activeManualLine, scopeEditInFlight, onClearManualQuantity]);

  const handleExclude = useCallback(async () => {
    if (!activeExcludeLine || scopeEditInFlight) return;
    await onExcludeLine(activeExcludeLine.templateItemId);
  }, [activeExcludeLine, onExcludeLine, scopeEditInFlight]);

  const saveDisabled =
    !activeQuantityLine ||
    scopeEditInFlight ||
    quantityDraft.trim().length === 0 ||
    !validateManualQuantityInput(quantityDraft).ok;

  if (!open || typeof document === "undefined") {
    return null;
  }

  const packageName = optionLabel?.trim() || "package";
  const reviewCountLabel =
    scopeReviewCount > 0
      ? `${scopeReviewCount} quantit${scopeReviewCount === 1 ? "y" : "ies"} need review`
      : manualActiveLines.length > 0
        ? `${manualActiveLines.length} custom quantit${manualActiveLines.length === 1 ? "y" : "ies"} on this package`
        : "No quantities need review";

  const showQuantityEditor =
    showLiveQuantity && activeQuantityLine && drawerIntent === "quantity";
  const hasPackageActions = Boolean(activeExcludeLine && showLiveExclude);

  return createPortal(
    <>
      <div
        className={WORKBENCH_EDIT_OPTION_DRAWER_BACKDROP}
        aria-hidden="true"
        onClick={() => {
          if (!scopeEditInFlight) onClose();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !scopeEditInFlight) {
            onClose();
          }
        }}
      />

      <aside
        className={WORKBENCH_EDIT_OPTION_DRAWER_PANEL}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-edit-option-title"
        aria-describedby="workbench-edit-option-desc"
        data-builder-edit-package-drawer
      >
        <header className={WORKBENCH_EDIT_OPTION_DRAWER_HEADER}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
                {WORKBENCH_EDIT_PACKAGE_TITLE}
              </p>
              <h3 className={`${WORKBENCH_MODULE_TITLE} mt-1`} id="workbench-edit-option-title">
                Edit {packageName} package
              </h3>
              <p className="mt-1 text-[13px] leading-snug text-slate-600" id="workbench-edit-option-desc">
                Contractor-only changes for this proposal draft.
              </p>
              <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600">
                {reviewCountLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={scopeEditInFlight}
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close Edit scope"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className={WORKBENCH_EDIT_OPTION_DRAWER_BODY}>
          <p className="text-[13px] leading-relaxed text-slate-600">
            {showLiveQuantity || showLiveExclude
              ? WORKBENCH_EDIT_OPTION_INTRO_COPY_LIVE
              : WORKBENCH_EDIT_OPTION_INTRO_COPY}
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
            {WORKBENCH_EDIT_OPTION_TRUST_COPY}
          </p>

          <section className="mt-5" aria-labelledby="edit-option-quantity-review">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <h4
                  className="text-[13px] font-semibold text-slate-900"
                  id="edit-option-quantity-review"
                >
                  Quantity review
                </h4>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Lines that need contractor attention first.
                </p>
              </div>
            </div>

            {!persistedDraftEnabled ? (
              <p className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3 text-[12.5px] leading-relaxed text-slate-600">
                Save the proposal draft before reviewing quantities.
              </p>
            ) : reviewLines.length === 0 ? (
              <p className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-3 text-[12.5px] text-slate-500">
                No quantities need review on this package.
              </p>
            ) : (
              <ul
                className="overflow-hidden rounded-xl border border-slate-200/80 bg-white"
                aria-label="Quantity review lines"
              >
                {reviewLines.map((line) => {
                  const isActive = line.templateItemId === focusedTemplateItemId;
                  const isEditingThis = isActive && showQuantityEditor;
                  const isCustomQuantity = line.kind === "manual_active";

                  return (
                    <li
                      key={line.templateItemId}
                      className={`relative border-b border-slate-100 last:border-b-0 transition ${
                        isActive
                          ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200"
                          : "bg-white hover:bg-slate-50/70"
                      }`}
                      data-builder-quantity-review-line
                      data-selected={isActive ? "true" : "false"}
                    >
                      {isActive ? (
                        <span
                          className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-blue-600"
                          aria-hidden
                        />
                      ) : null}
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
                        onClick={() =>
                          onFocusTemplateItemId(
                            isActive ? null : line.templateItemId
                          )
                        }
                        disabled={scopeEditInFlight}
                        aria-expanded={isActive}
                        data-builder-quantity-review-toggle
                        aria-label={
                          isActive
                            ? `Collapse ${line.name}`
                            : `Expand ${line.name}`
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-slate-900">
                            {line.name}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-slate-500">
                            {isCustomQuantity && line.quantityDisplayLabel
                              ? `Custom quantity · ${line.quantityDisplayLabel}`
                              : line.unitLabel
                                ? `Needs quantity · ${line.unitLabel}`
                                : "Needs quantity"}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {isActive ? (
                            <span className="text-[10.5px] font-semibold text-blue-700">
                              Editing
                            </span>
                          ) : null}
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-400 transition ${
                              isActive ? "rotate-180 text-blue-600" : ""
                            }`}
                            aria-hidden
                          />
                        </span>
                      </button>

                      {isEditingThis ? (
                        <div
                          className="border-t border-blue-100/90 px-3.5 pb-3.5 pt-3"
                          data-builder-selected-quantity-editor
                        >
                          {isCustomQuantity && activeManualLine ? (
                            <div className="mb-3 flex items-baseline justify-between gap-3">
                              <p className="text-[11.5px] font-medium text-slate-500">
                                Current custom quantity
                              </p>
                              <p className="text-[13px] font-semibold tabular-nums text-slate-900">
                                {activeManualLine.quantityDisplayLabel}
                              </p>
                            </div>
                          ) : null}
                          <label
                            htmlFor="edit-option-manual-quantity"
                            className="text-[12px] font-semibold text-slate-700"
                          >
                            {isCustomQuantity ? "Change custom quantity" : "Set custom quantity"}
                          </label>
                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              id="edit-option-manual-quantity"
                              type="text"
                              inputMode="decimal"
                              value={quantityDraft}
                              onChange={(event) => {
                                setQuantityDraft(event.target.value);
                                setLocalValidationError(null);
                              }}
                              disabled={scopeEditInFlight}
                              placeholder="Enter quantity"
                              className={WORKBENCH_EDIT_OPTION_CONTROL_ENABLED}
                              aria-invalid={Boolean(localValidationError || manualQuantityError)}
                            />
                            {activeQuantityLine?.unitLabel ? (
                              <span className="shrink-0 text-[12px] font-medium text-slate-500">
                                {activeQuantityLine.unitLabel}
                              </span>
                            ) : null}
                          </div>
                          {localValidationError ? (
                            <p className="mt-1.5 text-[12px] text-red-600" role="alert">
                              {localValidationError}
                            </p>
                          ) : null}
                          {manualQuantityError ? (
                            <p className="mt-1.5 text-[12px] text-red-600" role="alert">
                              {manualQuantityError}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSave()}
                              disabled={saveDisabled}
                              className={WORKBENCH_EDIT_OPTION_SAVE_BTN}
                            >
                              {scopeEditInFlight ? "Saving…" : "Save quantity"}
                            </button>
                            {isCustomQuantity && activeManualLine ? (
                              <button
                                type="button"
                                onClick={() => void handleClear()}
                                disabled={scopeEditInFlight}
                                className={WORKBENCH_EDIT_OPTION_USE_MEASUREMENT_BTN}
                                aria-label={`${WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL} for ${activeManualLine.name}`}
                              >
                                {scopeEditInFlight
                                  ? "Restoring…"
                                  : WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL}
                              </button>
                            ) : null}
                          </div>
                          {isCustomQuantity ? (
                            <p className="mt-2 text-[11.5px] leading-snug text-slate-500">
                              {WORKBENCH_MANUAL_QUANTITY_RESET_HELPER}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {hasPackageActions ? (
            <section className="mt-6" aria-labelledby="edit-option-package-actions">
              <h4
                className="text-[13px] font-semibold text-slate-900"
                id="edit-option-package-actions"
              >
                Package actions
              </h4>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Available for the selected line.
              </p>
              <div className="mt-3 space-y-2">
                {activeExcludeLine && showLiveExclude ? (
                  <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3">
                    <p className="text-[13px] font-medium text-slate-800">{activeExcludeLine.name}</p>
                    <p className="mt-1 text-[12px] leading-snug text-slate-500">
                      {WORKBENCH_EXCLUDE_HELPER_COPY}
                    </p>
                    {excludeError ? (
                      <p className="mt-1.5 text-[12px] text-red-600" role="alert">
                        {excludeError}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className={`${WORKBENCH_EXCLUDE_ACTION_BTN} mt-2.5`}
                      disabled={scopeEditInFlight}
                      onClick={() => void handleExclude()}
                    >
                      {scopeEditInFlight
                        ? WORKBENCH_EXCLUDE_IN_FLIGHT_LABEL
                        : WORKBENCH_EXCLUDE_ACTION_LABEL}
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="mt-6">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left text-[12px] font-medium text-slate-500 transition hover:text-slate-700"
              onClick={() => setFutureOpen((value) => !value)}
              aria-expanded={futureOpen}
              data-builder-future-package-tools
            >
              <span>Future package tools</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${futureOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {futureOpen ? (
              <ul className="mt-1 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                {FUTURE_PACKAGE_TOOLS.map((tool) => (
                  <li
                    key={tool.id}
                    className="rounded-md px-2 py-2 opacity-60"
                    aria-disabled="true"
                  >
                    <p className="text-[12px] font-medium text-slate-600">{tool.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                      {tool.description}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Coming soon
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <footer className={WORKBENCH_EDIT_OPTION_DRAWER_FOOTER}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11.5px] leading-snug text-slate-500">
              Saved changes apply immediately to this proposal draft.
            </p>
            <button
              type="button"
              onClick={onClose}
              disabled={scopeEditInFlight}
              className={WORKBENCH_EDIT_OPTION_SAVE_BTN}
            >
              Done
            </button>
          </div>
        </footer>
      </aside>
    </>,
    document.body
  );
}
