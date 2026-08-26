"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CanonicalJobStage, OperationalJobDisposition } from "@/app/lib/jobLifecycleTypes";
import {
  DISPOSITION_REASON_MAX_LENGTH,
  dispositionConfirmCopy,
  mapDispositionMutationError,
  normalizeDispositionReason,
  resolveDispositionManagementActions,
  resolveOperationalDisposition,
  type DispositionManagementAction,
} from "@/app/lib/jobDispositionManagement";

export type JobDispositionAppliedResult = {
  job_id: string;
  to_status: OperationalJobDisposition;
  idempotent: boolean;
};

type JobCardDispositionControlProps = {
  jobId: string | null;
  disposition: string | null | undefined;
  stage: CanonicalJobStage | string;
  stageLabel: string;
  disabled?: boolean;
  onApplied: (result: JobDispositionAppliedResult) => Promise<void> | void;
};

export default function JobCardDispositionControl({
  jobId,
  disposition,
  stage,
  stageLabel,
  disabled = false,
  onApplied,
}: JobCardDispositionControlProps) {
  const actions = resolveDispositionManagementActions(disposition);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<DispositionManagementAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(
    null
  );
  const dialogTitleId = useId();
  const confirmCopy = pendingAction
    ? dispositionConfirmCopy({ target: pendingAction.target, stage })
    : null;

  useEffect(() => {
    setMenuOpen(false);
    setPendingAction(null);
    setReason("");
    setError(null);
    setBusy(false);
  }, [jobId, disposition]);

  useEffect(() => {
    if (!menuOpen && !pendingAction) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (pendingAction && !busy) {
        setPendingAction(null);
        setError(null);
        triggerRef.current?.focus();
        return;
      }
      if (menuOpen) {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, pendingAction, busy]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuBox(null);
      return;
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuBox({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const first = rootRef.current?.querySelector<HTMLButtonElement>(
      "[data-jobcard-disposition-action]"
    );
    first?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (!pendingAction) return;
    const dialog = document.querySelector<HTMLElement>(
      "[data-jobcard-disposition-dialog]"
    );
    const focusTarget =
      dialog?.querySelector<HTMLElement>("textarea") ??
      dialog?.querySelector<HTMLElement>("[data-jobcard-disposition-confirm]");
    focusTarget?.focus();
  }, [pendingAction]);

  if (actions.length === 0 || !jobId) return null;

  const openConfirm = (action: DispositionManagementAction) => {
    setMenuOpen(false);
    setPendingAction(action);
    setReason("");
    setError(null);
  };

  const closeConfirm = () => {
    if (busy) return;
    setPendingAction(null);
    setError(null);
    triggerRef.current?.focus();
  };

  const submit = async () => {
    if (!pendingAction || busy || disabled) return;
    setBusy(true);
    setError(null);
    const targetJobId = jobId;
    const targetStatus = pendingAction.target;
    try {
      const response = await fetch("/api/jobs/change-disposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: targetJobId,
          toStatus: targetStatus,
          reason: normalizeDispositionReason(reason),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        setError(mapDispositionMutationError(result?.code));
        return;
      }
      const toStatus =
        resolveOperationalDisposition(result?.to_status) ?? targetStatus;
      try {
        await onApplied({
          job_id: typeof result.job_id === "string" ? result.job_id : targetJobId,
          to_status: toStatus,
          idempotent: Boolean(result.idempotent),
        });
      } catch {
        /* RPC succeeded; parent retains known transition if refresh failed. */
      }
      setPendingAction(null);
      setReason("");
    } catch {
      setError(mapDispositionMutationError("internal_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="relative" data-jobcard-disposition-actions>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Job actions"
        disabled={disabled || busy}
        data-jobcard-disposition-menu-trigger
        onClick={() => {
          setMenuOpen((open) => {
            const next = !open;
            if (next) {
              const rect = triggerRef.current?.getBoundingClientRect();
              if (rect) {
                setMenuBox({
                  top: rect.bottom + 6,
                  right: Math.max(8, window.innerWidth - rect.right),
                });
              }
            } else {
              setMenuBox(null);
            }
            return next;
          });
        }}
        className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70 disabled:opacity-60"
      >
        Job actions
      </button>
      {menuOpen ? (
        <div
          role="menu"
          aria-label="Job actions"
          data-jobcard-disposition-menu
          className="fixed z-[60] min-w-[10.5rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          style={{
            top: menuBox?.top ?? 48,
            right: menuBox?.right ?? 12,
          }}
        >
          {actions.map((action) => (
            <button
              key={action.target}
              type="button"
              role="menuitem"
              disabled={disabled || busy}
              data-jobcard-disposition-action={action.kind}
              onClick={() => openConfirm(action)}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              {action.menuLabel}
            </button>
          ))}
        </div>
      ) : null}

      {pendingAction && confirmCopy ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          data-jobcard-disposition-dialog={pendingAction.kind}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2
              id={dialogTitleId}
              className="text-base font-semibold text-slate-900"
            >
              {pendingAction.confirmTitle}
            </h2>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Current stage: {stageLabel}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {confirmCopy.body}
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Reason (optional)
              <textarea
                value={reason}
                maxLength={DISPOSITION_REASON_MAX_LENGTH}
                disabled={busy}
                aria-label="Reason (optional)"
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
              />
            </label>
            {error ? (
              <p
                className="mt-3 text-sm text-rose-700"
                data-jobcard-disposition-error
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={busy}
                className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                aria-busy={busy}
                data-jobcard-disposition-confirm
                className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Saving…" : pendingAction.confirmActionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
