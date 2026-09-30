"use client";

import { useEffect, useState } from "react";
import type { CompanyMemberClientItem } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import { labelForCompanyMember } from "@/app/tools/roofing/jobCard/useCompanyMembers";

type JobCardProductionLeadControlProps = {
  jobId: string;
  assignedTo: string | null;
  crewLabel: string | null;
  canAssign: boolean;
  members: readonly CompanyMemberClientItem[];
  onUpdated: (next: {
    assignedTo: string | null;
    crewLabel: string | null;
  }) => void;
  /**
   * When embedded in the field brief, show only the Assign/Change control
   * (lead name already appears in the brief hierarchy).
   */
  embedInBrief?: boolean;
};

export default function JobCardProductionLeadControl({
  jobId,
  assignedTo,
  crewLabel,
  canAssign,
  members,
  onUpdated,
  embedInBrief = false,
}: JobCardProductionLeadControlProps) {
  const [editing, setEditing] = useState(false);
  const [draftAssignee, setDraftAssignee] = useState(assignedTo ?? "");
  const [draftCrew, setDraftCrew] = useState(crewLabel ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setDraftAssignee(assignedTo ?? "");
    setDraftCrew(crewLabel ?? "");
  }, [assignedTo, crewLabel, editing]);

  const leadLabel = labelForCompanyMember(assignedTo, members);

  const save = async () => {
    if (!canAssign || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextAssigned = draftAssignee.trim() ? draftAssignee.trim() : null;
      const nextCrew = draftCrew.trim() ? draftCrew.trim().slice(0, 80) : null;
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/production-lead`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignedTo: nextAssigned,
            crewLabel: nextCrew,
          }),
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
        crewLabel: nextCrew,
      });
      setEditing(false);
    } catch {
      setError("Could not update coordinator.");
    } finally {
      setBusy(false);
    }
  };

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
            {crewLabel?.trim() ? (
              <p className="mt-0.5 text-xs text-slate-400">{crewLabel.trim()}</p>
            ) : null}
          </div>
          {canAssign ? (
            <button
              type="button"
              className="min-h-[40px] shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
              data-testid="job-production-lead-assign"
              onClick={() => {
                setError(null);
                setDraftAssignee(assignedTo ?? "");
                setDraftCrew(crewLabel ?? "");
                setEditing((open) => !open);
              }}
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
          onClick={() => {
            setError(null);
            setDraftAssignee(assignedTo ?? "");
            setDraftCrew(crewLabel ?? "");
            setEditing((open) => !open);
          }}
        >
          {editing ? "Cancel" : assignedTo ? "Change" : "Assign"}
        </button>
      ) : null}

      {editing && canAssign ? (
        <div
          className={
            embedInBrief
              ? "mt-2 space-y-2 sm:text-left"
              : "mt-2 space-y-2"
          }
          data-jobcard-production-lead-editor
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="min-h-[40px] min-w-[10rem] flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
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
              className="inline-flex min-h-[40px] shrink-0 items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void save()}
              data-jobcard-production-lead-save
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
          <input
            type="text"
            maxLength={80}
            value={draftCrew}
            disabled={busy}
            placeholder="Crew label (optional)"
            aria-label="Crew label optional"
            className="min-h-[36px] w-full rounded-md border border-slate-200/80 bg-white px-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
            onChange={(event) => setDraftCrew(event.target.value)}
            data-jobcard-production-lead-crew
          />
          {error ? (
            <p className="text-sm text-rose-700" data-jobcard-production-lead-error>
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
