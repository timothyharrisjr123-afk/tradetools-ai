"use client";

import type { ReactNode } from "react";
import { MapPin, Phone } from "lucide-react";
import {
  resolveFieldBriefTaskPreview,
  type FieldBriefTasksReadStatus,
  type FieldBriefViewModel,
} from "@/app/lib/fieldBriefModel";
import {
  OVERVIEW_BODY,
  OVERVIEW_FACT_LABEL,
  OVERVIEW_FACT_TEXT,
  OVERVIEW_FACT_TEXT_QUIET,
  OVERVIEW_GROUP_HEADING,
  OVERVIEW_LINK,
  OVERVIEW_META,
  OVERVIEW_UTILITY,
} from "./jobCardOverviewStyles";

type JobCardFieldBriefProps = {
  model: FieldBriefViewModel;
  /** Compact production-lead assignment control (Change / Assign), not a second card. */
  leadAction?: ReactNode;
  /** When true, hide quiet photo count if Photos tab is the source of truth nearby. */
  quietPhotoHint?: boolean;
  /**
   * Overview sits under Job Card header identity — skip repeating name/address,
   * keep Call/Directions + operational hierarchy.
   */
  omitIdentityHero?: boolean;
  /** False when the state region already owns planned window and lead. */
  showScheduleLead?: boolean;
  /** False when a lower work-history record owns the planned window. */
  showPlanned?: boolean;
  /** False before anything is accepted: there is no work to describe yet. */
  showAuthorizedWork?: boolean;
  authorizedWorkHeading?: string;
  /** Task read state; defaults to ready for callers that resolved their facts. */
  tasksReadStatus?: FieldBriefTasksReadStatus;
  onOpenTasks?: () => void;
  /** Route to scope details in its owning domain (commercial viewers only). */
  onOpenProposals?: () => void;
  /** Opt-in canonical Overview presentation; other callers retain their layout. */
  overviewMode?: "work" | "record";
};

function OverviewGroup({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? <div className="min-w-0 space-y-2">{children}</div> : <>{children}</>;
}

export default function JobCardFieldBrief({
  model,
  leadAction = null,
  quietPhotoHint = false,
  omitIdentityHero = false,
  showScheduleLead = true,
  showPlanned = true,
  showAuthorizedWork = true,
  authorizedWorkHeading = "Authorized work",
  tasksReadStatus = "ready",
  onOpenTasks,
  onOpenProposals,
  overviewMode,
}: JobCardFieldBriefProps) {
  const { contact, schedule, authorizedWork, tasks } = model;
  const warning = authorizedWork.warningProposedVsAuthorized;
  const openTasks = tasks.filter((task) => task.status === "open");
  const taskPreview = resolveFieldBriefTaskPreview({ tasks, status: tasksReadStatus });
  const schedulePrimary =
    schedule.windowLabel ||
    (schedule.startsOn
      ? `${schedule.startsOn}${
          schedule.endsOn && schedule.endsOn !== schedule.startsOn
            ? ` → ${schedule.endsOn}`
            : ""
        }`
      : null);

  const utilities =
    contact.canCall || contact.canDirections ? (
      <div className="flex flex-wrap gap-2" data-field-brief-utilities>
        {contact.canDirections && contact.mapsUrl ? (
          <a
            href={contact.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={OVERVIEW_UTILITY}
          >
            <MapPin className="h-4 w-4 text-slate-500" strokeWidth={1.75} aria-hidden />
            Directions
          </a>
        ) : null}
        {contact.canCall && contact.telUrl ? (
          <a href={contact.telUrl} className={OVERVIEW_UTILITY}>
            <Phone className="h-4 w-4 text-slate-500" strokeWidth={1.75} aria-hidden />
            Call
          </a>
        ) : null}
      </div>
    ) : null;

  const scopeLoading =
    authorizedWork.status === "loading" &&
    !authorizedWork.approvedScopeLabel &&
    !authorizedWork.approvedChangesLabel;

  const siteContext = (
    <>
      {authorizedWork.accessNotes ? (
        <div className={overviewMode ? undefined : "pt-2"} data-field-brief-access-notes>
          <p className={OVERVIEW_FACT_LABEL}>Site &amp; schedule notes</p>
          <p className={`${OVERVIEW_BODY} [overflow-wrap:anywhere]`}>{authorizedWork.accessNotes}</p>
        </div>
      ) : null}
      {utilities ? (overviewMode ? utilities : <div className="pt-2">{utilities}</div>) : null}
      {overviewMode === "record" ? (
        <div>
          <p className={OVERVIEW_FACT_LABEL}>Production lead</p>
          <p className={OVERVIEW_FACT_TEXT_QUIET}>{schedule.productionLeadLabel}</p>
          {schedule.crewLabel ? <p className={OVERVIEW_META}>{schedule.crewLabel}</p> : null}
          {leadAction}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className="space-y-6"
      data-testid="job-field-brief"
      data-jobcard-field-brief="true"
    >
      {!omitIdentityHero ? (
        <div className="min-w-0 space-y-1">
          <p className="text-lg font-semibold tracking-tight text-slate-950 [overflow-wrap:anywhere]">
            {contact.customerName || "Customer"}
          </p>
          {contact.addressLine ? (
            <p className="text-sm leading-snug text-slate-600 [overflow-wrap:anywhere]">
              {contact.addressLine}
            </p>
          ) : (
            <p className="text-sm text-slate-400">No service address on file</p>
          )}
          {contact.phone ? (
            <p className="text-sm text-slate-500">{contact.phone}</p>
          ) : null}
        </div>
      ) : null}

      {/* Work: what is authorized, what is pending, and site constraints on it */}
      {showAuthorizedWork ? (
        <section className={overviewMode ? "grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-8" : "space-y-2"} data-field-brief-work>
          <OverviewGroup enabled={Boolean(overviewMode)}>
          <h3 className={OVERVIEW_GROUP_HEADING}>{authorizedWorkHeading}</h3>
          {scopeLoading ? (
            <p className={OVERVIEW_META} data-field-brief-scope-loading>
              Checking authorized work…
            </p>
          ) : authorizedWork.approvedScopeLabel ? (
            <p className={`${OVERVIEW_BODY} font-medium text-slate-900 [overflow-wrap:anywhere]`}>
              {authorizedWork.approvedScopeLabel}
            </p>
          ) : authorizedWork.approvedChangesLabel ? (
            // Authorized changes still count as authorized work when base
            // line-level scope cannot be projected yet — never contradict.
            null
          ) : (
            <p className={OVERVIEW_META}>No authorized scope on file</p>
          )}
          {authorizedWork.approvedChangesLabel ? (
            <p
              className={`${OVERVIEW_BODY} [overflow-wrap:anywhere] ${
                authorizedWork.approvedScopeLabel ? "" : "font-medium text-slate-900"
              }`}
              data-field-brief-authorized-changes
            >
              {authorizedWork.approvedScopeLabel ? (
                <span className="text-slate-500">Approved changes · </span>
              ) : null}
              {authorizedWork.approvedChangesLabel}
            </p>
          ) : null}
          {warning ? (
            <p
              className="rounded-md bg-amber-50/70 px-3 py-2 text-sm text-amber-900"
              data-field-brief-pending-scope
            >
              {warning}
            </p>
          ) : null}
          {onOpenProposals &&
          !scopeLoading &&
          (authorizedWork.approvedScopeLabel || authorizedWork.approvedChangesLabel) ? (
            <button
              type="button"
              className={`${OVERVIEW_LINK} -mt-1`}
              onClick={onOpenProposals}
              data-field-brief-scope-details
            >
              Scope details
            </button>
          ) : null}
          {authorizedWork.measurementSummary ? (
            <p className={OVERVIEW_META}>Measurement · {authorizedWork.measurementSummary}</p>
          ) : null}
          </OverviewGroup>
          {overviewMode === "record" ? (
            <details className="min-w-0 text-sm text-slate-600" data-field-brief-record-context>
              <summary className="min-h-11 cursor-pointer py-2 font-medium text-slate-700">Site &amp; responsibility</summary>
              <div className="space-y-3 pt-2">{siteContext}</div>
            </details>
          ) : overviewMode ? (
            <div className="min-w-0 space-y-3">{siteContext}</div>
          ) : siteContext}
        </section>
      ) : authorizedWork.measurementSummary || authorizedWork.accessNotes || utilities ? (
        <section className="space-y-2" data-field-brief-preparation>
          {authorizedWork.measurementSummary ? (
            <div>
              <p className={OVERVIEW_FACT_LABEL}>Measurement</p>
              <p className={OVERVIEW_FACT_TEXT}>{authorizedWork.measurementSummary}</p>
            </div>
          ) : null}
          {authorizedWork.accessNotes ? (
            <div data-field-brief-access-notes>
              <p className={OVERVIEW_FACT_LABEL}>Site &amp; schedule notes</p>
              <p className={`${OVERVIEW_BODY} [overflow-wrap:anywhere]`}>
                {authorizedWork.accessNotes}
              </p>
            </div>
          ) : null}
          {utilities}
        </section>
      ) : null}

      {/* Tasks: only when there is something to see (or the read is unresolved) */}
      {taskPreview.kind === "loading" ? (
        <p className={OVERVIEW_META} data-field-brief-tasks-loading>
          Checking tasks…
        </p>
      ) : taskPreview.kind === "error" ? (
        <div className="flex flex-wrap items-center gap-x-3" role="alert" data-field-brief-tasks-error>
          <p className="text-sm text-red-700">Tasks could not be loaded.</p>
          {onOpenTasks ? (
            <button type="button" className={OVERVIEW_LINK} onClick={onOpenTasks}>
              Open Tasks
            </button>
          ) : null}
        </div>
      ) : taskPreview.kind === "preview" ? (
        <section className="space-y-2 border-t border-slate-100 pt-5" data-field-brief-tasks>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className={OVERVIEW_GROUP_HEADING}>
              Open tasks <span className="font-normal text-slate-500">· {taskPreview.openCount}</span>
            </h3>
            {!quietPhotoHint && model.photoCount > 0 ? (
              <span className="text-xs text-slate-400">{model.photoCount} photos</span>
            ) : null}
          </div>
          <ul className="space-y-2">
            {taskPreview.visible.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-4">
                <span className={`${OVERVIEW_BODY} min-w-0 [overflow-wrap:anywhere]`}>
                  {task.title}
                </span>
                <span className="shrink-0 text-right text-[13px] leading-5 text-slate-500">
                  <span className="block">{task.assigneeLabel}</span>
                  {task.dueOn ? <span className="block text-slate-400">{task.dueOn}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {onOpenTasks ? (
            <button
              type="button"
              className={OVERVIEW_LINK}
              onClick={onOpenTasks}
              data-field-brief-tasks-open
            >
              {taskPreview.hiddenCount > 0
                ? `View all ${openTasks.length} open tasks`
                : "Open Tasks"}
            </button>
          ) : null}
        </section>
      ) : null}

      {/* Plan and responsibility when the state region does not own them */}
      {showScheduleLead && overviewMode !== "record" ? (
        <section
          className="flex flex-wrap gap-x-10 gap-y-3 border-t border-slate-100 pt-5"
          data-field-brief-schedule-lead
        >
          {showPlanned && schedulePrimary ? (
            <div className="min-w-0">
              <p className={OVERVIEW_FACT_LABEL}>Planned</p>
              <p className={OVERVIEW_FACT_TEXT}>{schedulePrimary}</p>
              {schedule.timezone ? (
                <p className="text-xs text-slate-500">{schedule.timezone}</p>
              ) : null}
            </div>
          ) : null}
          <div className="min-w-0">
            <p className={OVERVIEW_FACT_LABEL}>Production lead</p>
            <p
              className={
                schedule.productionLeadLabel === "Unassigned"
                  ? OVERVIEW_FACT_TEXT_QUIET
                  : OVERVIEW_FACT_TEXT
              }
            >
              {schedule.productionLeadLabel}
            </p>
            {schedule.crewLabel ? (
              <p className="text-xs text-slate-500">{schedule.crewLabel}</p>
            ) : null}
            {leadAction}
          </div>
        </section>
      ) : null}
    </div>
  );
}
