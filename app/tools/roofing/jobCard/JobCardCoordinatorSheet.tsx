"use client";

import { useState } from "react";
import TeamSheet, { TEAM_SHEET_PRIMARY } from "@/app/tools/settings/team/TeamSheet";
import PersonChoiceList from "@/app/components/ui/PersonChoiceList";
import {
  COORDINATOR_NONE_KEY,
  COORDINATOR_PICKER_HELP,
  coordinatorChoices,
  coordinatorConfirmLabel,
  coordinatorKeyToUserId,
} from "@/app/lib/jobCoordinatorView";

export type CoordinatorMembersStatus = "loading" | "error" | "ready";

type JobCardCoordinatorSheetProps = {
  jobId: string;
  jobName: string;
  /** The Coordinator the viewer sees now. */
  assignedTo: string | null;
  currentLabel: string;
  /** Eligible people, already reduced to display names. */
  candidates: readonly { userId: string; label: string }[];
  membersStatus: CoordinatorMembersStatus;
  onRetryMembers: () => void;
  saving: boolean;
  error: string | null;
  onConfirm: (next: string | null, nextLabel: string) => void;
  onClose: () => void;
};

const QUIET_LINK =
  "inline-flex min-h-[40px] items-center rounded-md px-1 text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** Choose the job's Coordinator. Choosing a row never saves; the footer confirms. */
export default function JobCardCoordinatorSheet({
  jobId,
  jobName,
  assignedTo,
  currentLabel,
  candidates,
  membersStatus,
  onRetryMembers,
  saving,
  error,
  onConfirm,
  onClose,
}: JobCardCoordinatorSheetProps) {
  const [draft, setDraft] = useState<string>(assignedTo ?? COORDINATOR_NONE_KEY);
  const helpId = `coordinator-help-${jobId}`;
  const options = coordinatorChoices({ assignedTo, currentLabel, candidates });
  const next = coordinatorKeyToUserId(draft);
  const nextLabel = options.find((option) => option.key === draft)?.label ?? "";
  const confirmLabel = membersStatus === "ready" ? coordinatorConfirmLabel({ assignedTo, next, nextLabel }) : null;

  return (
    <TeamSheet
      view="job-coordinator"
      title={assignedTo ? "Change coordinator" : "Assign coordinator"}
      subtitle={jobName}
      backLabel="Job"
      busy={saving}
      error={error}
      onClose={onClose}
      footer={
        <button
          type="button"
          className={`${TEAM_SHEET_PRIMARY} w-full`}
          disabled={saving || !confirmLabel}
          onClick={() => onConfirm(next, nextLabel)}
          data-jobcard-coordinator-confirm={confirmLabel ? (next ? "person" : "unassigned") : "none"}
        >
          {saving ? "Saving…" : confirmLabel ?? "Save"}
        </button>
      }
    >
      <p id={helpId} className="mb-4 text-sm text-slate-500" data-jobcard-production-lead-help>
        {COORDINATOR_PICKER_HELP}
      </p>
      {membersStatus === "loading" ? (
        <div className="space-y-2" aria-busy="true" data-jobcard-coordinator-members="loading">
          <p className="sr-only" role="status">
            Loading people…
          </p>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex min-h-[56px] items-center gap-3 rounded-lg border border-slate-100 px-3.5 py-2.5"
              aria-hidden
            >
              <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-100" />
              <span className="h-3 w-32 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : membersStatus === "error" ? (
        <div className="space-y-2" data-jobcard-coordinator-members="error">
          <p className="text-sm text-slate-700" role="alert">
            People couldn&apos;t be loaded.
          </p>
          <button type="button" className={QUIET_LINK} onClick={onRetryMembers}>
            Try again
          </button>
        </div>
      ) : (
        <PersonChoiceList
          label="Coordinator"
          describedBy={helpId}
          options={options}
          value={draft}
          onChange={setDraft}
          disabled={saving}
          name="coordinator"
        />
      )}
    </TeamSheet>
  );
}
