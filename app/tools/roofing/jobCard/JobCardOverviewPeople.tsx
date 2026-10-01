"use client";

import type { ReactNode } from "react";
import { User, UserRound, Users } from "lucide-react";
import type { JobCrewFactView } from "@/app/lib/jobCrewAssignmentView";
import { jobCrewFactState } from "./JobCardCrewFact";
import {
  OVERVIEW_CARD,
  OVERVIEW_CARD_LABEL,
  OVERVIEW_CARD_NAME,
  OVERVIEW_CARD_NAME_QUIET,
  OVERVIEW_ICON_BLUE,
  OVERVIEW_ICON_GREEN,
  OVERVIEW_ICON_QUIET,
} from "./jobCardOverviewStyles";

export const JOB_CARD_COORDINATOR_CONTEXT = "Coordinates this job." as const;

function PersonCard({
  kind,
  icon,
  iconClassName,
  label,
  name,
  quiet,
  lines = null,
  action = null,
  below = null,
  factState,
  coordinatorState,
}: {
  kind: "coordinator" | "crew";
  icon: ReactNode;
  iconClassName: string;
  label: string;
  name: string;
  quiet: boolean;
  lines?: ReactNode;
  action?: ReactNode;
  below?: ReactNode;
  factState?: string;
  coordinatorState?: string;
}) {
  return (
    <div
      className={`${OVERVIEW_CARD} min-w-0 px-5 py-5`}
      data-jobcard-overview-person={kind}
      data-job-crew-fact={factState}
      data-jobcard-coordinator-state={coordinatorState}
    >
      <div className="flex items-start gap-4">
        <span className={iconClassName} aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={OVERVIEW_CARD_LABEL}>{label}</p>
          <p className={`mt-1 ${quiet ? OVERVIEW_CARD_NAME_QUIET : OVERVIEW_CARD_NAME} [overflow-wrap:anywhere]`}>
            {name}
          </p>
          {lines}
        </div>
        {action ? <div className="shrink-0 self-center">{action}</div> : null}
      </div>
      {below ? <div className="mt-4">{below}</div> : null}
    </div>
  );
}

/** The Coordinator: who coordinates the job. Never the Crew, never access. */
export function JobCardOverviewCoordinatorCard({
  name,
  state,
  trigger = null,
  editor = null,
}: {
  name: string;
  /** Loading and read failure are quiet like Unassigned but never claim it. */
  state?: "assigned" | "unassigned" | "loading" | "error";
  trigger?: ReactNode;
  editor?: ReactNode;
}) {
  const assigned = state ? state === "assigned" : name !== "Unassigned";
  return (
    <PersonCard
      kind="coordinator"
      icon={<UserRound className="h-5 w-5" strokeWidth={1.75} />}
      iconClassName={assigned ? OVERVIEW_ICON_BLUE : OVERVIEW_ICON_QUIET}
      label="Coordinator"
      name={name}
      quiet={!assigned}
      coordinatorState={state}
      lines={
        !assigned ? null : (
          <p className="mt-1 text-sm text-slate-500" data-jobcard-coordinator-context>
            {JOB_CARD_COORDINATOR_CONTEXT}
          </p>
        )
      }
      action={trigger}
      below={editor}
    />
  );
}

/** The Crew: who does the work. The person leading it is a plain name, not a title. */
export function JobCardOverviewCrewCard({
  view,
  action = null,
}: {
  view: JobCrewFactView;
  action?: ReactNode;
}) {
  const hasCrew = !view.quiet;
  return (
    <PersonCard
      kind="crew"
      icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
      iconClassName={hasCrew ? OVERVIEW_ICON_GREEN : OVERVIEW_ICON_QUIET}
      label={view.label}
      name={view.text}
      quiet={view.quiet}
      factState={jobCrewFactState(view)}
      lines={
        <>
          {view.leadName ? (
            <p
              className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-slate-700"
              data-job-crew-lead
            >
              <User className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 [overflow-wrap:anywhere]">{view.leadName}</span>
            </p>
          ) : null}
          {view.legacyNote ? (
            <p className="mt-1 text-[13px] leading-snug text-slate-500 [overflow-wrap:anywhere]" data-job-crew-legacy-note>
              {view.legacyNote}
            </p>
          ) : null}
          {view.dispositionNote ? (
            <p className="mt-1 text-[13px] leading-snug text-slate-500" data-job-crew-disposition-note>
              {view.dispositionNote}
            </p>
          ) : null}
        </>
      }
      action={action}
    />
  );
}

/** Coordinator and Crew side by side: related, never merged into "Assigned to". */
export default function JobCardOverviewPeople({
  coordinator,
  crew,
}: {
  coordinator: ReactNode;
  crew: ReactNode;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2" data-jobcard-overview-people aria-label="Coordinator and crew">
      {coordinator}
      {crew}
    </section>
  );
}
