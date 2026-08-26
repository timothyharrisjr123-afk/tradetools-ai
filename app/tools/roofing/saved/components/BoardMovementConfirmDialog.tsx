"use client";

import { useEffect, useRef } from "react";

type BoardMovementConfirmDialogProps = {
  title: string;
  body?: string | null;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function BoardMovementConfirmDialog({
  title,
  body,
  confirmLabel,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: BoardMovementConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    confirmRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/25 px-4"
      data-board-movement-confirm
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="board-movement-confirm-title"
        aria-describedby={body ? "board-movement-confirm-body" : undefined}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
      >
        <h2
          id="board-movement-confirm-title"
          className="text-sm font-semibold text-slate-900"
        >
          {title}
        </h2>
        {body ? (
          <p
            id="board-movement-confirm-body"
            className="mt-2 text-sm leading-relaxed text-slate-600"
          >
            {body}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-amber-800" role="alert">
            {error}
          </p>
        ) : null}
        {busy ? (
          <p className="sr-only" role="status" aria-live="polite">
            Working
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            onClick={onConfirm}
            disabled={busy}
            data-board-movement-confirm-submit
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
