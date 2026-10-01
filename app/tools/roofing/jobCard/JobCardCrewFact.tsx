"use client";

import { useEffect, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import type { JobCrewFactView } from "@/app/lib/jobCrewAssignmentView";
import JobCardCrewSheet, { type JobCardCrewSheetProps } from "@/app/tools/roofing/jobCard/JobCardCrewSheet";
import {
  OVERVIEW_FACT_LABEL,
  OVERVIEW_FACT_TEXT,
  OVERVIEW_FACT_TEXT_QUIET,
  OVERVIEW_META,
  OVERVIEW_NEUTRAL_ACTION,
  OVERVIEW_SOFT_ACTION,
} from "./jobCardOverviewStyles";

const ACTION =
  "mt-1 inline-flex min-h-[36px] items-center rounded-md text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** The Crew fact's one action: Assign crew / Change / Remove crew / Try again. */
export function JobCardCrewActionButton({
  view,
  onOpen,
  onRetry,
  appearance = "link",
}: {
  view: JobCrewFactView;
  onOpen: () => void;
  onRetry: () => void;
  /** "card": the Overview Crew card's tinted action. */
  appearance?: "link" | "card";
}) {
  if (!view.action || !view.actionLabel) return null;
  const card = appearance === "card";
  const soft = view.action === "change" || view.action === "assign";
  const Icon = view.action === "change" ? Pencil : view.action === "assign" ? Plus : null;
  return (
    <button
      type="button"
      className={card ? (soft ? OVERVIEW_SOFT_ACTION : OVERVIEW_NEUTRAL_ACTION) : ACTION}
      onClick={view.action === "retry" ? onRetry : onOpen}
      data-job-crew-action={view.action}
    >
      {card && Icon ? <Icon className="h-4 w-4" strokeWidth={2} aria-hidden /> : null}
      {view.actionLabel}
    </button>
  );
}

/**
 * The Crew sheet and its quiet confirmation, mounted once per Job Card so a
 * disposition change that moves the Crew fact never closes the sheet mid-decision.
 */
export function JobCardCrewLayer({
  open,
  toast,
  onToastDone,
  ...sheet
}: JobCardCrewSheetProps & {
  open: boolean;
  toast: string | null;
  onToastDone: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onToastDone, 4000);
    return () => window.clearTimeout(timer);
  }, [toast, onToastDone]);

  return (
    <>
      {open ? <JobCardCrewSheet {...sheet} /> : null}
      {toast ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
          data-job-crew-toast
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
}

export function jobCrewFactState(view: JobCrewFactView): "current" | "last" | "none" {
  return view.current ? "current" : view.label === "Last crew" ? "last" : "none";
}

/** Compact Crew fact (Field Brief). The person is a plain name, never "· Lead". */
export default function JobCardCrewFact({
  view,
  action = null,
}: {
  view: JobCrewFactView;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0" data-job-crew-fact={jobCrewFactState(view)}>
      <p className={OVERVIEW_FACT_LABEL}>{view.label}</p>
      <p className={`${view.quiet ? OVERVIEW_FACT_TEXT_QUIET : OVERVIEW_FACT_TEXT} [overflow-wrap:anywhere]`}>
        {view.text}
      </p>
      {view.leadName ? (
        <p className={`${OVERVIEW_META} [overflow-wrap:anywhere]`} data-job-crew-lead>
          {view.leadName}
        </p>
      ) : null}
      {view.legacyNote ? (
        <p className={`${OVERVIEW_META} [overflow-wrap:anywhere]`} data-job-crew-legacy-note>
          {view.legacyNote}
        </p>
      ) : null}
      {view.dispositionNote ? (
        <p className={OVERVIEW_META} data-job-crew-disposition-note>
          {view.dispositionNote}
        </p>
      ) : null}
      {action}
    </div>
  );
}
