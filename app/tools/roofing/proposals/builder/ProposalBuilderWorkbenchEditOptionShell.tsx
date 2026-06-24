"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, SlidersHorizontal, X } from "lucide-react";
import {
  validateManualQuantityInput,
} from "@/app/lib/proposalScopeDecisionActions";
import {
  WORKBENCH_EDIT_OPTION_CANCEL_BTN,
  WORKBENCH_EDIT_OPTION_COMING_SOON_BADGE,
  WORKBENCH_EDIT_OPTION_CONTROL,
  WORKBENCH_EDIT_OPTION_CONTROL_BTN,
  WORKBENCH_EDIT_OPTION_CONTROL_ENABLED,
  WORKBENCH_EDIT_OPTION_DRAWER_BACKDROP,
  WORKBENCH_EDIT_OPTION_DRAWER_BODY,
  WORKBENCH_EDIT_OPTION_DRAWER_FOOTER,
  WORKBENCH_EDIT_OPTION_DRAWER_HEADER,
  WORKBENCH_EDIT_OPTION_DRAWER_PANEL,
  WORKBENCH_EDIT_OPTION_FOOTER_COPY,
  WORKBENCH_EDIT_OPTION_FOOTER_COPY_LIVE,
  WORKBENCH_EDIT_OPTION_INTRO_COPY,
  WORKBENCH_EDIT_OPTION_INTRO_COPY_LIVE,
  WORKBENCH_EDIT_OPTION_LINE_PICKER,
  WORKBENCH_EDIT_OPTION_LINE_PICKER_ACTIVE,
  WORKBENCH_EDIT_OPTION_SAVE_BTN,
  WORKBENCH_EDIT_OPTION_SECTION,
  WORKBENCH_EDIT_OPTION_SECTION_DESC,
  WORKBENCH_EDIT_OPTION_SECTION_TITLE,
  WORKBENCH_EDIT_OPTION_TITLE,
  WORKBENCH_EDIT_OPTION_TRUST_COPY,
  WORKBENCH_EDIT_OPTION_USE_MEASUREMENT_BTN,
  WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL,
  WORKBENCH_MANUAL_QUANTITY_ACTIVE_BADGE,
  WORKBENCH_MANUAL_QUANTITY_ACTIVE_READOUT,
  WORKBENCH_MANUAL_QUANTITY_RESET_HELPER,
  WORKBENCH_EXCLUDE_ACTION_BTN,
  WORKBENCH_EXCLUDE_ACTION_LABEL,
  WORKBENCH_EXCLUDE_HELPER_COPY,
  WORKBENCH_EXCLUDE_IN_FLIGHT_LABEL,
  WORKBENCH_EXCLUDE_SECTION_DESC,
  WORKBENCH_EXCLUDE_SECTION_TITLE,
  WORKBENCH_HIDE_ACTION_BTN,
  WORKBENCH_HIDE_ACTION_LABEL,
  WORKBENCH_HIDE_HELPER_COPY,
  WORKBENCH_HIDE_IN_FLIGHT_LABEL,
  WORKBENCH_HIDE_SECTION_DESC,
  WORKBENCH_HIDE_SECTION_TITLE,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_KICKER,
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

type EditOptionShellSection = {
  id: string;
  title: string;
  description: string;
  controlLabel: string;
  controlKind: "input" | "button" | "select";
};

const DISABLED_SHELL_SECTIONS: readonly EditOptionShellSection[] = [
  {
    id: "catalog",
    title: "Add from catalog",
    description: "Pull additional catalog items into this option’s scope.",
    controlLabel: "Browse catalog",
    controlKind: "button",
  },
  {
    id: "custom",
    title: "Add custom line",
    description: "Add a one-off line item for this job only.",
    controlLabel: "Add custom line",
    controlKind: "button",
  },
  {
    id: "upgrade",
    title: "Move to optional upgrade",
    description: "Reclassify a line as an optional upgrade for customer selection at signing.",
    controlLabel: "Move to upgrade",
    controlKind: "select",
  },
  {
    id: "quantity_source",
    title: "Quantity source / measurement mapping",
    description: "Choose which measurement field drives quantity, or override with manual entry.",
    controlLabel: "Quantity source",
    controlKind: "select",
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
  onFocusTemplateItemId: (templateItemId: string) => void;
  persistedDraftEnabled: boolean;
  scopeEditInFlight: boolean;
  manualQuantityError: string | null;
  excludeError: string | null;
  visibilityError: string | null;
  onApplyManualQuantity: (templateItemId: string, quantity: string, quantityDisplayLabel?: string | null) => Promise<void>;
  onClearManualQuantity: (templateItemId: string) => Promise<void>;
  onExcludeLine: (templateItemId: string) => Promise<void>;
  onHideLine: (templateItemId: string) => Promise<void>;
};

function ShellSectionControl({ section }: { section: EditOptionShellSection }) {
  if (section.controlKind === "button") {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={WORKBENCH_EDIT_OPTION_CONTROL_BTN}
        title="Coming soon — not enabled in this phase"
      >
        {section.controlLabel}
      </button>
    );
  }

  return (
    <input
      type="text"
      disabled
      aria-disabled="true"
      readOnly
      placeholder={section.controlLabel}
      className={WORKBENCH_EDIT_OPTION_CONTROL}
      title="Coming soon — not enabled in this phase"
    />
  );
}

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

  const activeHideLine = useMemo(() => {
    if (!focusedTemplateItemId) return null;
    return hideEligibleLines.find((line) => line.templateItemId === focusedTemplateItemId) ?? null;
  }, [hideEligibleLines, focusedTemplateItemId]);

  const editableLineCount =
    scopeReviewLines.length + manualActiveLines.length + excludeEligibleLines.length + hideEligibleLines.length;
  const showLiveQuantity = persistedDraftEnabled && (scopeReviewLines.length > 0 || manualActiveLines.length > 0);
  const showLiveExclude = persistedDraftEnabled && excludeEligibleLines.length > 0;
  const showLiveHide = persistedDraftEnabled && hideEligibleLines.length > 0;
  const manualActiveMode = Boolean(activeManualLine);
  const excludeMode = drawerIntent === "exclude" && Boolean(activeExcludeLine);
  const visibilityMode = drawerIntent === "visibility" && Boolean(activeHideLine);

  const pickerLines = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{
      templateItemId: string;
      name: string;
      kind: "scope_review" | "manual_active" | "exclude_eligible" | "hide_eligible";
    }> = [];
    for (const line of scopeReviewLines) {
      if (seen.has(line.templateItemId)) continue;
      seen.add(line.templateItemId);
      rows.push({ templateItemId: line.templateItemId, name: line.name, kind: "scope_review" });
    }
    for (const line of manualActiveLines) {
      if (seen.has(line.templateItemId)) continue;
      seen.add(line.templateItemId);
      rows.push({ templateItemId: line.templateItemId, name: line.name, kind: "manual_active" });
    }
    for (const line of excludeEligibleLines) {
      if (seen.has(line.templateItemId)) continue;
      seen.add(line.templateItemId);
      rows.push({ templateItemId: line.templateItemId, name: line.name, kind: "exclude_eligible" });
    }
    for (const line of hideEligibleLines) {
      if (seen.has(line.templateItemId)) continue;
      seen.add(line.templateItemId);
      rows.push({ templateItemId: line.templateItemId, name: line.name, kind: "hide_eligible" });
    }
    return rows;
  }, [excludeEligibleLines, hideEligibleLines, manualActiveLines, scopeReviewLines]);

  useEffect(() => {
    if (!open) {
      setQuantityDraft("");
      setLocalValidationError(null);
    }
  }, [open]);

  useEffect(() => {
    setQuantityDraft("");
    setLocalValidationError(null);
  }, [focusedTemplateItemId]);

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
    if (!activeScopeReviewLine || scopeEditInFlight) return;

    const validation = validateManualQuantityInput(quantityDraft);
    if (!validation.ok) {
      setLocalValidationError(validation.message);
      return;
    }

    setLocalValidationError(null);
    const unit = activeScopeReviewLine.unitLabel?.trim();
    const displayLabel = unit ? `${validation.quantity} ${unit}` : String(validation.quantity);
    await onApplyManualQuantity(activeScopeReviewLine.templateItemId, quantityDraft, displayLabel);
  }, [activeScopeReviewLine, scopeEditInFlight, onApplyManualQuantity, quantityDraft]);

  const handleClear = useCallback(async () => {
    if (!activeManualLine || scopeEditInFlight) return;
    await onClearManualQuantity(activeManualLine.templateItemId);
  }, [activeManualLine, scopeEditInFlight, onClearManualQuantity]);

  const handleExclude = useCallback(async () => {
    if (!activeExcludeLine || scopeEditInFlight) return;
    await onExcludeLine(activeExcludeLine.templateItemId);
  }, [activeExcludeLine, onExcludeLine, scopeEditInFlight]);

  const handleHide = useCallback(async () => {
    if (!activeHideLine || scopeEditInFlight) return;
    await onHideLine(activeHideLine.templateItemId);
  }, [activeHideLine, onHideLine, scopeEditInFlight]);

  const saveDisabled =
    !activeScopeReviewLine ||
    scopeEditInFlight ||
    quantityDraft.trim().length === 0 ||
    !validateManualQuantityInput(quantityDraft).ok;

  if (!open || typeof document === "undefined") {
    return null;
  }

  const scopeHint =
    visibilityMode && activeHideLine
      ? `Hide ${activeHideLine.name} from the customer proposal while keeping it in the package total.`
      : excludeMode && activeExcludeLine
      ? `Remove ${activeExcludeLine.name} from this package for this job.`
      : scopeReviewCount > 0
        ? `${scopeReviewCount} item${scopeReviewCount === 1 ? "" : "s"} in scope review — set manual quantity, hide from customer, or remove from this option below.`
        : manualActiveLines.length > 0
          ? `${manualActiveLines.length} manual quantit${manualActiveLines.length === 1 ? "y" : "ies"} active on this package.`
          : hideEligibleLines.length > 0
            ? "Hide priced lines from the customer proposal without changing option totals."
            : excludeEligibleLines.length > 0
            ? "Remove template lines from this package without changing the master template."
            : "No scope review lines need quantity on this package.";

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
      >
        <header className={WORKBENCH_EDIT_OPTION_DRAWER_HEADER}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                <p className={WORKBENCH_MODULE_KICKER} id="workbench-edit-option-kicker">
                  Package scope
                </p>
                {!showLiveQuantity && !showLiveExclude && !showLiveHide ? (
                  <span className={WORKBENCH_EDIT_OPTION_COMING_SOON_BADGE}>Coming soon</span>
                ) : null}
              </div>
              <h3 className={WORKBENCH_MODULE_TITLE} id="workbench-edit-option-title">
                {WORKBENCH_EDIT_OPTION_TITLE}
              </h3>
              {optionLabel ? (
                <p className="mt-0.5 truncate text-[13px] font-medium text-slate-700">{optionLabel}</p>
              ) : null}
              <p className={`${WORKBENCH_MODULE_DESC} mt-2`} id="workbench-edit-option-desc">
                {scopeHint}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={scopeEditInFlight}
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close Edit option"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className={WORKBENCH_EDIT_OPTION_DRAWER_BODY}>
          <div className="space-y-3 rounded-lg border border-blue-100/80 bg-blue-50/40 px-3.5 py-3">
            <p className="text-[13px] leading-relaxed text-slate-700">
              {showLiveQuantity ? WORKBENCH_EDIT_OPTION_INTRO_COPY_LIVE : WORKBENCH_EDIT_OPTION_INTRO_COPY}
            </p>
            <p className="text-[12px] leading-snug text-slate-500">{WORKBENCH_EDIT_OPTION_TRUST_COPY}</p>
          </div>

          <div className="mt-4 space-y-3">
            <section
              className={WORKBENCH_EDIT_OPTION_SECTION}
              aria-labelledby="edit-option-section-quantity"
            >
              <h4 className={WORKBENCH_EDIT_OPTION_SECTION_TITLE} id="edit-option-section-quantity">
                Quantity decisions
              </h4>
              <p className={WORKBENCH_EDIT_OPTION_SECTION_DESC}>
                Set a manual quantity for this proposal option when measurement mapping is unresolved.
              </p>

              {!persistedDraftEnabled ? (
                <input
                  type="text"
                  disabled
                  readOnly
                  placeholder="Manual quantity"
                  className={WORKBENCH_EDIT_OPTION_CONTROL}
                  title="Save the proposal draft before editing scope"
                />
              ) : editableLineCount === 0 ? (
                <p className="mt-2.5 text-[12px] text-slate-500">
                  No scope review lines need quantity on this package.
                </p>
              ) : (
                <div className="mt-2.5 space-y-3">
                  {pickerLines.length > 1 ? (
                    <ul className="space-y-1.5" aria-label="Editable scope lines">
                      {pickerLines.map((line) => {
                        const isActive = line.templateItemId === focusedTemplateItemId;
                        return (
                          <li key={line.templateItemId}>
                            <button
                              type="button"
                              className={
                                isActive
                                  ? WORKBENCH_EDIT_OPTION_LINE_PICKER_ACTIVE
                                  : WORKBENCH_EDIT_OPTION_LINE_PICKER
                              }
                              onClick={() => onFocusTemplateItemId(line.templateItemId)}
                              disabled={scopeEditInFlight}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span>{line.name}</span>
                                {line.kind === "manual_active" ? (
                                  <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-800">
                                    {WORKBENCH_MANUAL_QUANTITY_ACTIVE_BADGE}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {manualActiveMode && activeManualLine ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[12px] font-medium text-slate-700">{activeManualLine.name}</p>
                        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800">
                          {WORKBENCH_MANUAL_QUANTITY_ACTIVE_BADGE}
                        </span>
                      </div>
                      <p className={WORKBENCH_MANUAL_QUANTITY_ACTIVE_READOUT} aria-live="polite">
                        {activeManualLine.quantityDisplayLabel}
                      </p>
                      <p className="mt-2 text-[12px] leading-snug text-slate-600">
                        {WORKBENCH_MANUAL_QUANTITY_RESET_HELPER}
                      </p>
                      {manualQuantityError ? (
                        <p className="mt-1.5 text-[12px] text-red-600" role="alert">
                          {manualQuantityError}
                        </p>
                      ) : null}
                    </div>
                  ) : activeScopeReviewLine ? (
                    <div>
                      <label
                        htmlFor="edit-option-manual-quantity"
                        className="text-[12px] font-medium text-slate-700"
                      >
                        {activeScopeReviewLine.name}
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
                        {activeScopeReviewLine.unitLabel ? (
                          <span className="shrink-0 text-[12px] font-medium text-slate-500">
                            {activeScopeReviewLine.unitLabel}
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
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-500">
                      Select a line to review quantity decisions.
                    </p>
                  )}
                </div>
              )}
            </section>

            {showLiveExclude ? (
              <section
                className={WORKBENCH_EDIT_OPTION_SECTION}
                aria-labelledby="edit-option-section-exclude"
              >
                <h4 className={WORKBENCH_EDIT_OPTION_SECTION_TITLE} id="edit-option-section-exclude">
                  {WORKBENCH_EXCLUDE_SECTION_TITLE}
                </h4>
                <p className={WORKBENCH_EDIT_OPTION_SECTION_DESC}>{WORKBENCH_EXCLUDE_SECTION_DESC}</p>
                {activeExcludeLine ? (
                  <div className="mt-2.5 space-y-2">
                    <p className="text-[12px] font-medium text-slate-700">{activeExcludeLine.name}</p>
                    <p className="text-[12px] leading-snug text-slate-600">{WORKBENCH_EXCLUDE_HELPER_COPY}</p>
                    {excludeError ? (
                      <p className="text-[12px] text-red-600" role="alert">
                        {excludeError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2.5 text-[12px] text-slate-500">
                    Select a line to remove from this option.
                  </p>
                )}
              </section>
            ) : null}

            {showLiveHide ? (
              <section
                className={WORKBENCH_EDIT_OPTION_SECTION}
                aria-labelledby="edit-option-section-visibility"
              >
                <h4 className={WORKBENCH_EDIT_OPTION_SECTION_TITLE} id="edit-option-section-visibility">
                  {WORKBENCH_HIDE_SECTION_TITLE}
                </h4>
                <p className={WORKBENCH_EDIT_OPTION_SECTION_DESC}>{WORKBENCH_HIDE_SECTION_DESC}</p>
                {activeHideLine ? (
                  <div className="mt-2.5 space-y-2">
                    <p className="text-[12px] font-medium text-slate-700">{activeHideLine.name}</p>
                    <p className="text-[12px] leading-snug text-slate-600">{WORKBENCH_HIDE_HELPER_COPY}</p>
                    {visibilityError ? (
                      <p className="text-[12px] text-red-600" role="alert">
                        {visibilityError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2.5 text-[12px] text-slate-500">
                    Select a priced line to hide from the customer proposal.
                  </p>
                )}
              </section>
            ) : null}

            {DISABLED_SHELL_SECTIONS.map((section) => (
              <section
                key={section.id}
                className={WORKBENCH_EDIT_OPTION_SECTION}
                aria-labelledby={`edit-option-section-${section.id}`}
              >
                <h4 className={WORKBENCH_EDIT_OPTION_SECTION_TITLE} id={`edit-option-section-${section.id}`}>
                  {section.title}
                </h4>
                <p className={WORKBENCH_EDIT_OPTION_SECTION_DESC}>{section.description}</p>
                <ShellSectionControl section={section} />
              </section>
            ))}
          </div>
        </div>

        <footer className={WORKBENCH_EDIT_OPTION_DRAWER_FOOTER}>
          {showLiveQuantity && manualActiveMode && activeManualLine ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={scopeEditInFlight}
                className={WORKBENCH_EDIT_OPTION_CANCEL_BTN}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleClear()}
                disabled={scopeEditInFlight}
                className={WORKBENCH_EDIT_OPTION_USE_MEASUREMENT_BTN}
              >
                {scopeEditInFlight ? "Clearing…" : WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL}
              </button>
            </div>
          ) : excludeMode && showLiveExclude && activeExcludeLine ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={scopeEditInFlight}
                className={WORKBENCH_EDIT_OPTION_CANCEL_BTN}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExclude()}
                disabled={scopeEditInFlight}
                className={WORKBENCH_EXCLUDE_ACTION_BTN}
              >
                {scopeEditInFlight ? WORKBENCH_EXCLUDE_IN_FLIGHT_LABEL : WORKBENCH_EXCLUDE_ACTION_LABEL}
              </button>
            </div>
          ) : visibilityMode && showLiveHide && activeHideLine ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={scopeEditInFlight}
                className={WORKBENCH_EDIT_OPTION_CANCEL_BTN}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleHide()}
                disabled={scopeEditInFlight}
                className={WORKBENCH_HIDE_ACTION_BTN}
              >
                {scopeEditInFlight ? WORKBENCH_HIDE_IN_FLIGHT_LABEL : WORKBENCH_HIDE_ACTION_LABEL}
              </button>
            </div>
          ) : showLiveQuantity && activeScopeReviewLine && drawerIntent === "quantity" ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={scopeEditInFlight}
                className={WORKBENCH_EDIT_OPTION_CANCEL_BTN}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saveDisabled}
                className={WORKBENCH_EDIT_OPTION_SAVE_BTN}
              >
                {scopeEditInFlight ? "Saving…" : "Save quantity"}
              </button>
            </div>
          ) : (
            <p className="flex items-start gap-2 text-[11px] leading-snug text-slate-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {showLiveQuantity
                  ? WORKBENCH_EDIT_OPTION_FOOTER_COPY_LIVE
                  : WORKBENCH_EDIT_OPTION_FOOTER_COPY}
              </span>
            </p>
          )}
        </footer>
      </aside>
    </>,
    document.body
  );
}
