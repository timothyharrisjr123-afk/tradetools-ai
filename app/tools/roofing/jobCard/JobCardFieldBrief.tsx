"use client";

import type { ReactNode } from "react";
import { FileText, ListChecks, MapPin, Phone } from "lucide-react";
import {
  resolveFieldBriefTaskPreview,
  type FieldBriefTasksReadStatus,
  type FieldBriefViewModel,
} from "@/app/lib/fieldBriefModel";
import {
  OVERVIEW_BODY,
  OVERVIEW_CARD,
  OVERVIEW_FACT_LABEL,
  OVERVIEW_FACT_TEXT,
  OVERVIEW_FACT_TEXT_QUIET,
  OVERVIEW_GROUP_HEADING,
  OVERVIEW_ICON_QUIET,
  OVERVIEW_LINK,
  OVERVIEW_META,
  OVERVIEW_UTILITY,
} from "./jobCardOverviewStyles";

const OVERVIEW_CARD_HEADING = "text-base font-semibold text-slate-900";
/** Icon + content row; trailing utilities drop to their own line under the text on phones. */
const OVERVIEW_ROW_CARD = `${OVERVIEW_CARD} flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-5 sm:flex-nowrap sm:gap-5`;
const OVERVIEW_ROW_TRAILING = "w-full shrink-0 pl-16 sm:ml-auto sm:w-auto sm:pl-0";

type JobCardFieldBriefProps = {
  model: FieldBriefViewModel;
  /** Compact production-lead assignment control (Change / Assign), not a second card. */
  leadAction?: ReactNode;
  /** The Crew fact (who does the work), shown beside the Coordinator; never merged with it. */
  crewFact?: ReactNode;
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
  /** The Overview's paired people row owns Coordinator and Crew; the brief never repeats them. */
  peopleElsewhere?: boolean;
};

function OverviewGroup({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">{children}</div> : <>{children}</>;
}

export default function JobCardFieldBrief({
  model,
  leadAction = null,
  crewFact = null,
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
  peopleElsewhere = false,
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

  const scopeUnknown =
    authorizedWork.status !== "ready" &&
    !authorizedWork.approvedScopeLabel &&
    !authorizedWork.approvedChangesLabel;
  const scopeLoading = scopeUnknown && authorizedWork.status === "loading";

  const accessNotes = authorizedWork.accessNotes ? (
    <div className={overviewMode ? "pt-1" : "pt-2"} data-field-brief-access-notes>
      <p className={OVERVIEW_FACT_LABEL}>Site &amp; schedule notes</p>
      <p className={`${OVERVIEW_BODY} [overflow-wrap:anywhere]`}>{authorizedWork.accessNotes}</p>
    </div>
  ) : null;
  const recordPeople = overviewMode === "record" && !peopleElsewhere;
  const siteContext = (
    <>
      {accessNotes}
      {utilities ? (overviewMode ? utilities : <div className="pt-2">{utilities}</div>) : null}
      {recordPeople ? (
        <div>
          <p className={OVERVIEW_FACT_LABEL}>Coordinator</p>
          <p className={OVERVIEW_FACT_TEXT_QUIET}>{schedule.productionLeadLabel}</p>
          {leadAction}
        </div>
      ) : null}
      {recordPeople && crewFact ? (
        <div data-field-brief-crew>{crewFact}</div>
      ) : null}
    </>
  );
  const hasRecordContext = Boolean(accessNotes || utilities || recordPeople);

  return (
    <div
      className={overviewMode ? "space-y-3" : "space-y-6"}
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
        <section
          className={
            overviewMode
              ? OVERVIEW_ROW_CARD
              : "space-y-2"
          }
          data-field-brief-work
        >
          {overviewMode ? (
            <span className={OVERVIEW_ICON_QUIET} aria-hidden>
              <FileText className="h-5 w-5" strokeWidth={1.75} />
            </span>
          ) : null}
          <OverviewGroup enabled={Boolean(overviewMode)}>
          <h3 className={overviewMode ? OVERVIEW_CARD_HEADING : OVERVIEW_GROUP_HEADING}>{authorizedWorkHeading}</h3>
          {scopeLoading ? (
            <p className={OVERVIEW_META} data-field-brief-scope-loading>
              Checking authorized work…
            </p>
          ) : scopeUnknown ? (
            <p className={OVERVIEW_META} data-field-brief-scope-unavailable>
              Authorized work couldn&apos;t be checked. Reload the page to try again.
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
            <p className={overviewMode ? "text-sm text-slate-500" : OVERVIEW_META}>
              No authorized scope on file{overviewMode ? "." : ""}
            </p>
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
          !scopeUnknown &&
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
          {overviewMode === "work" ? accessNotes : null}
          </OverviewGroup>
          {overviewMode === "record" ? (
            hasRecordContext ? (
              <details className={`min-w-0 text-sm text-slate-600 ${OVERVIEW_ROW_TRAILING}`} data-field-brief-record-context>
                <summary className="min-h-11 cursor-pointer py-2 font-medium text-slate-700">
                  {recordPeople ? <>Site &amp; responsibility</> : <>Site &amp; directions</>}
                </summary>
                <div className="space-y-3 pt-2">{siteContext}</div>
              </details>
            ) : null
          ) : overviewMode ? (
            utilities ? <div className={OVERVIEW_ROW_TRAILING}>{utilities}</div> : null
          ) : siteContext}
        </section>
      ) : (authorizedWork.measurementSummary || authorizedWork.accessNotes || utilities) && overviewMode ? (
        <section
          className={OVERVIEW_ROW_CARD}
          data-field-brief-preparation
        >
          <span className={OVERVIEW_ICON_QUIET} aria-hidden>
            <MapPin className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <OverviewGroup enabled>
            <h3 className={OVERVIEW_CARD_HEADING}>Site</h3>
            <p className="text-sm text-slate-600 [overflow-wrap:anywhere]" data-field-brief-site-address>
              {contact.addressLine || "No service address on file"}
            </p>
            {authorizedWork.measurementSummary ? (
              <p className="text-sm text-slate-600" data-field-brief-site-measurement>
                Measurement · {authorizedWork.measurementSummary}
              </p>
            ) : null}
            {authorizedWork.accessNotes ? (
              <p className="text-sm text-slate-600 [overflow-wrap:anywhere]" data-field-brief-access-notes>
                {authorizedWork.accessNotes}
              </p>
            ) : null}
          </OverviewGroup>
          {utilities ? <div className={OVERVIEW_ROW_TRAILING}>{utilities}</div> : null}
        </section>
      ) : authorizedWork.measurementSummary || authorizedWork.accessNotes || utilities ? (
        <section
          className={overviewMode ? `${OVERVIEW_CARD} space-y-3 px-5 py-5` : "space-y-2"}
          data-field-brief-preparation
        >
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
        <section
          className={
            overviewMode
              ? OVERVIEW_ROW_CARD
              : "space-y-2 border-t border-slate-100 pt-5"
          }
          data-field-brief-tasks
        >
          {overviewMode ? (
            <span className={OVERVIEW_ICON_QUIET} aria-hidden>
              <ListChecks className="h-5 w-5" strokeWidth={1.75} />
            </span>
          ) : null}
          <OverviewGroup enabled={Boolean(overviewMode)}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className={overviewMode ? OVERVIEW_CARD_HEADING : OVERVIEW_GROUP_HEADING}>
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
          </OverviewGroup>
        </section>
      ) : null}

      {/* Plan only: the people row owns Coordinator and Crew */}
      {peopleElsewhere && showScheduleLead && overviewMode !== "record" && showPlanned && schedulePrimary ? (
        <section className={`${OVERVIEW_CARD} px-5 py-4`} data-field-brief-schedule-lead>
          <p className={OVERVIEW_FACT_LABEL}>Planned</p>
          <p className={OVERVIEW_FACT_TEXT}>{schedulePrimary}</p>
          {schedule.timezone ? <p className="text-xs text-slate-500">{schedule.timezone}</p> : null}
        </section>
      ) : null}

      {/* Plan and responsibility when the state region does not own them */}
      {!peopleElsewhere && showScheduleLead && overviewMode !== "record" ? (
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
            <p className={OVERVIEW_FACT_LABEL}>Coordinator</p>
            <p
              className={
                schedule.productionLeadLabel === "Unassigned"
                  ? OVERVIEW_FACT_TEXT_QUIET
                  : OVERVIEW_FACT_TEXT
              }
            >
              {schedule.productionLeadLabel}
            </p>
            {leadAction}
          </div>
          {crewFact ? (
            <div className="min-w-0 basis-full sm:basis-auto" data-field-brief-crew>
              {crewFact}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
