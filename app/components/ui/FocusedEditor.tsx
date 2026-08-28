"use client";

import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * One focused editing surface: a right-side drawer on desktop, a bottom sheet
 * on small screens. It owns the only Save in its context, so the page behind it
 * never needs a save button.
 */

export const FOCUSED_EDITOR_SAVE =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

export const FOCUSED_EDITOR_SAVE_SUBDUED =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-200 px-4 text-sm font-semibold text-slate-500 transition disabled:cursor-not-allowed";

export const FOCUSED_EDITOR_CANCEL =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

/** Quiet close: 44px invisible hit, small grey icon, ring hugs the icon on keyboard focus only. */
export const FOCUSED_EDITOR_CLOSE =
  "group inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 text-slate-400 shadow-none outline-none ring-0 [box-shadow:none] [-webkit-tap-highlight-color:transparent] hover:text-slate-600 focus:border-0 focus:outline-none focus:ring-0 focus:[box-shadow:none] focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:[box-shadow:none]";

export const FOCUSED_EDITOR_LABEL = "block text-sm font-medium text-slate-700";

export const FOCUSED_EDITOR_INPUT =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

export const FOCUSED_EDITOR_HINT = "mt-1 text-xs leading-relaxed text-slate-500";

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
  savingLabel?: string;
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
  savingLabel = "Saving…",
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

  useLayoutEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });

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

  const saveLooksDisabled = saving || saveDisabled;
  const saveClass =
    saveLooksDisabled && !dirty ? FOCUSED_EDITOR_SAVE_SUBDUED : FOCUSED_EDITOR_SAVE;

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
        aria-labelledby="focused-editor-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex h-auto max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl outline-none sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:max-h-dvh sm:w-[26rem] sm:max-w-[26rem] sm:rounded-none sm:shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-1 px-4 pb-1 pt-3 sm:px-5">
          <div className="min-w-0 pt-1.5 pr-1">
            <h2 id="focused-editor-title" className="text-[15px] font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-sm leading-snug text-slate-500">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            tabIndex={-1}
            className={FOCUSED_EDITOR_CLOSE}
            aria-label={`Close ${title}`}
            onClick={requestClose}
            data-focused-editor-close
          >
            <span className="pointer-events-none inline-flex h-7 w-7 items-center justify-center rounded-md">
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
          </button>
        </div>

        <div
          className="min-h-0 space-y-3 overflow-y-auto px-4 py-3 sm:space-y-3.5 sm:px-5 sm:py-3.5"
          data-focused-editor-body
        >
          {children}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-2.5">
          {error ? (
            <p className="mb-2 text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : message ? (
            <p className="mb-2 text-sm text-slate-600" aria-live="polite">
              {message}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
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
              className={saveClass}
              onClick={onSave}
              disabled={saveLooksDisabled}
              data-focused-editor-save
            >
              {saving ? savingLabel : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
