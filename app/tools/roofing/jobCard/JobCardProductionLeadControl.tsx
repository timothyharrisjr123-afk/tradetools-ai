"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil, UserPlus } from "lucide-react";
import type { CompanyMemberClientItem } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import { labelForCompanyMember } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import { COORDINATOR_UNASSIGNED, coordinatorSavedMessage } from "@/app/lib/jobCoordinatorView";
import JobCardCoordinatorSheet, {
  type CoordinatorMembersStatus,
} from "@/app/tools/roofing/jobCard/JobCardCoordinatorSheet";

type JobCardProductionLeadControlProps = {
  jobId: string;
  /** Shown under the sheet title. */
  jobName?: string;
  /** The Coordinator the viewer sees; sent back as the expected previous value. */
  assignedTo: string | null;
  /** Visible Coordinator name (shared database resolution). */
  label?: string;
  canAssign: boolean;
  /** Active same-company software members (the company directory). */
  members: readonly CompanyMemberClientItem[];
  /** Directory read behind the picker; loading and failure are shown, never an empty list. */
  membersStatus?: CoordinatorMembersStatus;
  /** Re-read the directory (on open and on Try again). */
  onRefreshMembers?: () => void;
  onUpdated: (next: { assignedTo: string | null; displayName: string | null }) => void;
  /** The Coordinator changed elsewhere; the caller re-reads it. */
  onStale?: () => void;
  /**
   * When embedded in the field brief, show only the Assign/Change control
   * (lead name already appears in the brief hierarchy).
   */
  embedInBrief?: boolean;
  /**
   * Overview card placement: the caller lays out the trigger.
   * The trigger is null when the viewer can't assign.
   */
  renderCard?: (parts: { trigger: ReactNode }) => ReactNode;
  cardTriggerClassName?: string;
};

function newRequestId(): string {
  return `coord-${crypto.randomUUID()}`;
}

/** The Coordinator only. The Crew is a separate fact with its own control. */
export default function JobCardProductionLeadControl({
  jobId,
  jobName = "This job",
  assignedTo,
  label,
  canAssign,
  members,
  membersStatus = "ready",
  onRefreshMembers,
  onUpdated,
  onStale,
  embedInBrief = false,
  renderCard,
  cardTriggerClassName = "",
}: JobCardProductionLeadControlProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // One request id per intended change, reused when a lost response is retried.
  const pending = useRef<{ key: string; requestId: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const leadLabel = label ?? labelForCompanyMember(assignedTo, members);
  const candidates = members.map((member) => ({
    userId: member.userId,
    label: labelForCompanyMember(member.userId, members),
  }));

  const save = async (nextAssigned: string | null) => {
    if (!canAssign || busy) return;
    setBusy(true);
    setError(null);
    const key = `${assignedTo ?? ""}>${nextAssigned ?? ""}`;
    if (pending.current?.key !== key) pending.current = { key, requestId: newRequestId() };
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/production-lead`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: nextAssigned,
          expectedAssignedTo: assignedTo,
          requestId: pending.current.requestId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        assignedTo?: string | null;
        displayName?: string | null;
        message?: string;
      };
      if (!res.ok || body.ok !== true) {
        if (body.code) pending.current = null;
        setError(typeof body.message === "string" ? body.message : "Could not update coordinator.");
        if (body.code === "stale_coordinator") onStale?.();
        return;
      }
      pending.current = null;
      const saved = {
        assignedTo: body.assignedTo === undefined ? nextAssigned : body.assignedTo,
        displayName: typeof body.displayName === "string" ? body.displayName : null,
      };
      onUpdated(saved);
      setOpen(false);
      setToast(coordinatorSavedMessage(saved));
    } catch {
      setError("Could not update coordinator.");
    } finally {
      setBusy(false);
    }
  };

  const openSheet = () => {
    setError(null);
    setOpen(true);
    onRefreshMembers?.();
  };

  const triggerText = assignedTo ? "Change" : "Assign";
  const sheetLayer = (
    <>
      {open ? (
        <JobCardCoordinatorSheet
          jobId={jobId}
          jobName={jobName}
          assignedTo={assignedTo}
          currentLabel={leadLabel}
          candidates={candidates}
          membersStatus={membersStatus}
          onRetryMembers={() => onRefreshMembers?.()}
          saving={busy}
          error={error}
          onConfirm={(next) => void save(next)}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {toast ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
          data-jobcard-coordinator-toast
        >
          <p
            role="status"
            aria-live="polite"
            className="max-w-sm rounded-full bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white shadow-lg [overflow-wrap:anywhere]"
          >
            {toast}
          </p>
        </div>
      ) : null}
    </>
  );

  if (renderCard) {
    const TriggerIcon = assignedTo ? Pencil : UserPlus;
    const trigger = canAssign ? (
      <button
        type="button"
        className={cardTriggerClassName}
        data-testid="job-production-lead-assign"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openSheet}
      >
        <TriggerIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
        {triggerText}
      </button>
    ) : null;
    return (
      <div className="contents" data-testid="job-production-lead" data-jobcard-production-lead="true">
        {renderCard({ trigger })}
        {sheetLayer}
      </div>
    );
  }

  if (!canAssign && embedInBrief) {
    return null;
  }

  const plainTrigger = canAssign ? (
    <button
      type="button"
      className={
        embedInBrief
          ? "min-h-[36px] text-sm font-medium text-blue-600 hover:text-blue-700"
          : "min-h-[40px] shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
      }
      data-testid="job-production-lead-assign"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={openSheet}
    >
      {triggerText}
    </button>
  ) : null;

  return (
    <div
      className={embedInBrief ? "min-w-0" : "border-t border-slate-100 pt-3"}
      data-testid="job-production-lead"
      data-jobcard-production-lead="true"
    >
      {!embedInBrief ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
              Coordinator
            </p>
            <p
              className={
                leadLabel === COORDINATOR_UNASSIGNED
                  ? "mt-0.5 text-sm font-medium text-slate-400"
                  : "mt-0.5 text-sm font-semibold text-slate-900"
              }
            >
              {leadLabel}
            </p>
          </div>
          {plainTrigger}
        </div>
      ) : (
        plainTrigger
      )}
      {sheetLayer}
    </div>
  );
}
