"use client";

import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { FOCUSED_EDITOR_DIRTY_PROMPT } from "@/app/components/ui/FocusedEditor";

/**
 * The Team person sheet. Secondary to the Team page: one person, invitation, or
 * decision at a time. Desktop is a full-height sheet anchored right with its own
 * scrolling body and a footer only when there is a decision to confirm. Mobile
 * is a full-screen page with a back control and keyboard-safe footer.
 */

type TeamSheetProps = {
  title: string;
  subtitle?: string | null;
  /** Identity mark shown beside the title (person monogram). */
  leading?: ReactNode;
  /** Parent step inside the sheet, e.g. the person behind a removal. */
  backLabel?: string | null;
  onBack?: () => void;
  dirty?: boolean;
  busy?: boolean;
  error?: string | null;
  footer?: ReactNode;
  onClose: () => void;
  view: string;
  children: ReactNode;
};

export const TEAM_SHEET_PRIMARY =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

export const TEAM_SHEET_DESTRUCTIVE =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2";

export const TEAM_SHEET_SECONDARY =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export default function TeamSheet({
  title,
  subtitle = null,
  leading = null,
  backLabel = null,
  onBack,
  dirty = false,
  busy = false,
  error = null,
  footer = null,
  onClose,
  view,
  children,
}: TeamSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const confirmDiscard = useCallback(
    () => !dirty || window.confirm(FOCUSED_EDITOR_DIRTY_PROMPT),
    [dirty]
  );
  const requestClose = useCallback(() => {
    if (busy || !confirmDiscard()) return;
    onClose();
  }, [busy, confirmDiscard, onClose]);
  const requestBack = useCallback(() => {
    if (!onBack) return requestClose();
    if (busy || !confirmDiscard()) return;
    onBack();
  }, [busy, confirmDiscard, onBack, requestClose]);

  const requestCloseRef = useRef(requestClose);
  useLayoutEffect(() => {
    requestCloseRef.current = requestClose;
  }, [requestClose]);

  // Focus moves in once per open; switching steps inside the sheet must not steal it.
  useLayoutEffect(() => {
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
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
  }, []);

  return (
    <div className="fixed inset-0 z-50" data-team-sheet={view}>
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 hidden bg-slate-900/20 sm:block"
        aria-label={`Close ${title}`}
        onClick={requestClose}
        data-team-sheet-backdrop
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-sheet-title"
        tabIndex={-1}
        className="absolute inset-0 flex h-[100dvh] flex-col bg-white outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[30rem] sm:border-l sm:border-slate-200 sm:shadow-[0_0_48px_rgba(15,23,42,0.14)]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-2 sm:h-auto sm:px-4 sm:pt-3">
          <button
            type="button"
            className={`inline-flex min-h-[44px] items-center gap-0.5 rounded-md px-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              onBack ? "" : "sm:invisible"
            }`}
            onClick={requestBack}
            disabled={busy}
            data-team-sheet-back
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="max-w-[14rem] truncate">{backLabel ?? "Team"}</span>
          </button>
          <button
            type="button"
            className="hidden h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:inline-flex"
            aria-label={`Close ${title}`}
            onClick={requestClose}
            disabled={busy}
            data-team-sheet-close
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="flex shrink-0 items-start gap-3.5 border-b border-slate-100 px-5 pb-5 pt-1 sm:px-7 sm:pt-2">
          {leading}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="team-sheet-title"
              className="text-lg font-semibold leading-snug tracking-tight text-slate-900 [overflow-wrap:anywhere]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-slate-500 [overflow-wrap:anywhere]">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7" data-team-sheet-body>
          {children}
        </div>

        {footer || error ? (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-7">
            {error ? (
              <p className="mb-2 text-sm text-rose-700" role="alert" data-team-sheet-error>
                {error}
              </p>
            ) : null}
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
