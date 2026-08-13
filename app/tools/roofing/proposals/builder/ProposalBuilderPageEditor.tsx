"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import {
  assertInsertableDocumentToken,
  formatProposalDocumentTokenPlaceholder,
  insertTextAtCursor,
  resolveTextareaInsertionSelection,
} from "@/app/lib/proposalDocumentTokenPicker";
import ProposalBuilderTokenPickerMenu from "./ProposalBuilderTokenPickerMenu";

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
  pageTitle: string;
};

export default function ProposalBuilderPageEditor({
  draftBody,
  onDraftBodyChange,
  onSave,
  onCancel,
  saveDisabled = false,
  saveInFlight = false,
  saveError = null,
  pricingComplete = false,
  pageTitle,
}: ProposalBuilderPageEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    syncTextareaHeight();
  }, [syncTextareaHeight]);

  useEffect(() => {
    syncTextareaHeight();
  }, [draftBody, syncTextareaHeight]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || saveInFlight || event.defaultPrevented) return;
      if (document.querySelector('[role="menu"]')) return;
      event.preventDefault();
      onCancel();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel, saveInFlight]);

  const handleInsertToken = useCallback(
    (tokenName: string) => {
      const insertable = assertInsertableDocumentToken(tokenName);
      if (!insertable) return;

      const textarea = textareaRef.current;
      const currentValue = draftBody;
      const isFocused = document.activeElement === textarea;
      const selection = resolveTextareaInsertionSelection(
        currentValue,
        textarea?.selectionStart,
        textarea?.selectionEnd,
        isFocused
      );
      const placeholder = formatProposalDocumentTokenPlaceholder(insertable);
      const next = insertTextAtCursor({
        value: currentValue,
        selectionStart: selection.selectionStart,
        selectionEnd: selection.selectionEnd,
        insertText: placeholder,
      });

      onDraftBodyChange(next.value);

      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(next.selectionStart, next.selectionEnd);
      });
    },
    [draftBody, onDraftBodyChange]
  );

  return (
    <div
      className="mx-auto max-w-[42rem] px-5 pb-10 pt-1 sm:px-8"
      data-builder-page-editor
    >
      <textarea
        ref={textareaRef}
        value={draftBody}
        onChange={(event) => onDraftBodyChange(event.target.value)}
        rows={8}
        className="max-h-[min(18rem,calc(100dvh-22rem))] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[15.5px] leading-[1.7] text-slate-800 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 sm:max-h-none sm:overflow-hidden"
        aria-label={`Edit ${pageTitle}`}
        aria-invalid={saveError ? true : undefined}
        aria-describedby={saveError ? errorId : undefined}
        spellCheck
        data-builder-page-editor-input
      />

      {saveError ? (
        <p id={errorId} className="mt-3 text-[13px] font-medium text-red-700" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white/95 py-3 backdrop-blur-sm sm:static sm:bg-transparent sm:py-4 sm:backdrop-blur-none">
        <ProposalBuilderTokenPickerMenu
          pricingComplete={pricingComplete}
          onInsertToken={handleInsertToken}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled || saveInFlight}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:h-9"
            data-builder-page-save
          >
            {saveInFlight ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saveInFlight}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md px-3.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:h-9"
            data-builder-page-cancel
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
