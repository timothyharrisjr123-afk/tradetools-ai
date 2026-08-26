"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * One focused editing surface: a right-side drawer on desktop, a bottom sheet
 * on small screens. It owns the only Save in its context, so the page behind it
 * never needs a save button.
 */

export const FOCUSED_EDITOR_SAVE =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

export const FOCUSED_EDITOR_CANCEL =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

export const FOCUSED_EDITOR_LABEL = "block text-sm font-medium text-slate-700";

export const FOCUSED_EDITOR_INPUT =
  "mt-1.5 block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

export const FOCUSED_EDITOR_HINT = "mt-1 text-xs text-slate-500";

export const FOCUSED_EDITOR_DIRTY_PROMPT =
  "You have unsaved changes. Discard them?";

type FocusedEditorProps = {
  open: boolean;
  title: string;
  /** One short line of what this editor controls. No architecture notes. */
  description?: string;
  /** Blocks close without confirmation so edits are never lost silently. */
  dirty?: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  message?: string | null;
  error?: string | null;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
};

export default function FocusedEditor({
  open,
  title,
  description,
  dirty = false,
  saving = false,
  saveDisabled = false,
  saveLabel = "Save",
  message = null,
  error = null,
  onClose,
  onSave,
  children,
}: FocusedEditorProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm(FOCUSED_EDITOR_DIRTY_PROMPT)) return;
    onClose();
  }, [dirty, onClose, saving]);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus();
    };
  }, [open, requestClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" data-focused-editor>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label={`Close ${title}`}
        onClick={requestClose}
        data-focused-editor-backdrop
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-[30rem] sm:max-h-none sm:rounded-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={`Close ${title}`}
            onClick={requestClose}
            data-focused-editor-close
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {error ? (
            <p className="mb-2.5 text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : message ? (
            <p className="mb-2.5 text-sm text-slate-600" aria-live="polite">
              {message}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              className={FOCUSED_EDITOR_CANCEL}
              onClick={requestClose}
              disabled={saving}
              data-focused-editor-cancel
            >
              Cancel
            </button>
            <button
              type="button"
              className={FOCUSED_EDITOR_SAVE}
              onClick={onSave}
              disabled={saving || saveDisabled}
              data-focused-editor-save
            >
              {saving ? "Saving…" : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
