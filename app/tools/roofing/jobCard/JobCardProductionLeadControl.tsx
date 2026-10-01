"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pencil, UserPlus } from "lucide-react";
import type { CompanyMemberClientItem } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import { labelForCompanyMember } from "@/app/tools/roofing/jobCard/useCompanyMembers";

type JobCardProductionLeadControlProps = {
  jobId: string;
  assignedTo: string | null;
  canAssign: boolean;
  members: readonly CompanyMemberClientItem[];
  onUpdated: (next: { assignedTo: string | null }) => void;
  /**
   * When embedded in the field brief, show only the Assign/Change control
   * (lead name already appears in the brief hierarchy).
   */
  embedInBrief?: boolean;
  /**
   * Overview card placement: the caller lays out the trigger and the editor.
   * The trigger is null when the viewer can't assign.
   */
  renderCard?: (parts: { trigger: ReactNode; editor: ReactNode }) => ReactNode;
  cardTriggerClassName?: string;
};

/** The Coordinator only. The Crew is a separate fact with its own control. */
export default function JobCardProductionLeadControl({
  jobId,
  assignedTo,
  canAssign,
  members,
  onUpdated,
  embedInBrief = false,
  renderCard,
  cardTriggerClassName = "",
}: JobCardProductionLeadControlProps) {
  const [editing, setEditing] = useState(false);
  const [draftAssignee, setDraftAssignee] = useState(assignedTo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setDraftAssignee(assignedTo ?? "");
  }, [assignedTo, editing]);

  const leadLabel = labelForCompanyMember(assignedTo, members);

  const save = async () => {
    if (!canAssign || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextAssigned = draftAssignee.trim() ? draftAssignee.trim() : null;
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/production-lead`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedTo: nextAssigned }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        assignedTo?: string | null;
        message?: string;
      };
      if (!res.ok || body.ok !== true) {
        setError(
          typeof body.message === "string"
            ? body.message
            : "Could not update coordinator."
        );
        return;
      }
      onUpdated({
        assignedTo:
          body.assignedTo === undefined ? nextAssigned : body.assignedTo,
      });
      setEditing(false);
    } catch {
      setError("Could not update coordinator.");
    } finally {
      setBusy(false);
    }
  };

  const toggleEditing = () => {
    setError(null);
    setDraftAssignee(assignedTo ?? "");
    setEditing((open) => !open);
  };

  const editor =
    editing && canAssign ? (
      <div className="space-y-2" data-jobcard-production-lead-editor>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={draftAssignee}
            disabled={busy}
            aria-label="Coordinator"
            onChange={(event) => setDraftAssignee(event.target.value)}
            data-jobcard-production-lead-select
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {labelForCompanyMember(member.userId, members)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void save()}
            data-jobcard-production-lead-save
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        {error ? (
          <p className="text-sm text-rose-700" data-jobcard-production-lead-error>
            {error}
          </p>
        ) : null}
      </div>
    ) : null;

  if (renderCard) {
    const TriggerIcon = assignedTo ? Pencil : UserPlus;
    const trigger = canAssign ? (
      <button
        type="button"
        className={cardTriggerClassName}
        data-testid="job-production-lead-assign"
        aria-expanded={editing}
        onClick={toggleEditing}
      >
        {editing ? null : <TriggerIcon className="h-4 w-4" strokeWidth={2} aria-hidden />}
        {editing ? "Cancel" : assignedTo ? "Change" : "Assign"}
      </button>
    ) : null;
    return (
      <div className="contents" data-testid="job-production-lead" data-jobcard-production-lead="true">
        {renderCard({ trigger, editor })}
      </div>
    );
  }

  if (!canAssign && embedInBrief) {
    return null;
  }

  return (
    <div
      className={
        embedInBrief
          ? "min-w-0"
          : "border-t border-slate-100 pt-3"
      }
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
                leadLabel === "Unassigned"
                  ? "mt-0.5 text-sm font-medium text-slate-400"
                  : "mt-0.5 text-sm font-semibold text-slate-900"
              }
            >
              {leadLabel}
            </p>
          </div>
          {canAssign ? (
            <button
              type="button"
              className="min-h-[40px] shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
              data-testid="job-production-lead-assign"
              onClick={toggleEditing}
            >
              {editing ? "Cancel" : assignedTo ? "Change" : "Assign"}
            </button>
          ) : null}
        </div>
      ) : canAssign ? (
        <button
          type="button"
          className="min-h-[36px] text-sm font-medium text-blue-600 hover:text-blue-700"
          data-testid="job-production-lead-assign"
          onClick={toggleEditing}
        >
          {editing ? "Cancel" : assignedTo ? "Change" : "Assign"}
        </button>
      ) : null}

      {editor ? <div className="mt-2">{editor}</div> : null}
    </div>
  );
}
