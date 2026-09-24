"use client";

import type { ReactNode } from "react";
import { MapPin, Phone } from "lucide-react";
import type { FieldBriefViewModel } from "@/app/lib/fieldBriefModel";

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
};

function QuietLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
      {children}
    </p>
  );
}

export default function JobCardFieldBrief({
  model,
  leadAction = null,
  quietPhotoHint = false,
  omitIdentityHero = false,
}: JobCardFieldBriefProps) {
  const { contact, schedule, authorizedWork, tasks } = model;
  const warning = authorizedWork.warningProposedVsAuthorized;
  const openTasks = tasks.filter((task) => task.status === "open");
  const schedulePrimary =
    schedule.windowLabel ||
    (schedule.startsOn
      ? `${schedule.startsOn}${
          schedule.endsOn && schedule.endsOn !== schedule.startsOn
            ? ` → ${schedule.endsOn}`
            : ""
        }`
      : null);

  const actionRow =
    contact.canCall || contact.canDirections ? (
      <div className="flex flex-wrap gap-2">
        {contact.canCall && contact.telUrl ? (
          <a
            href={contact.telUrl}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 sm:flex-none"
          >
            <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Call
          </a>
        ) : null}
        {contact.canDirections && contact.mapsUrl ? (
          <a
            href={contact.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 sm:flex-none"
          >
            <MapPin className="h-4 w-4 text-slate-500" strokeWidth={1.75} aria-hidden />
            Directions
          </a>
        ) : null}
      </div>
    ) : null;

  return (
    <div
      className="space-y-5"
      data-testid="job-field-brief"
      data-jobcard-field-brief="true"
    >
      {!omitIdentityHero ? (
        <div className="space-y-3">
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
          {actionRow}
        </div>
      ) : actionRow ? (
        <div>{actionRow}</div>
      ) : null}

      {/* Schedule + production lead */}
      <div className={omitIdentityHero && !actionRow ? undefined : "border-t border-slate-100 pt-4"}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 space-y-1">
            <QuietLabel>When</QuietLabel>
            <p className="text-sm font-medium text-slate-900">
              {schedulePrimary || (
                <span className="font-normal text-slate-400">Not scheduled</span>
              )}
            </p>
            {schedule.timezone && schedulePrimary ? (
              <p className="text-xs text-slate-400">{schedule.timezone}</p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1 sm:text-right">
            <QuietLabel>Production lead</QuietLabel>
            <p
              className={
                schedule.productionLeadLabel === "Unassigned"
                  ? "text-sm font-medium text-slate-400"
                  : "text-sm font-semibold text-slate-900"
              }
            >
              {schedule.productionLeadLabel}
            </p>
            {schedule.crewLabel ? (
              <p className="text-xs text-slate-400">{schedule.crewLabel}</p>
            ) : null}
            {leadAction ? <div className="pt-0.5 sm:flex sm:justify-end">{leadAction}</div> : null}
          </div>
        </div>
      </div>

      {/* Authorized work + measurement / access */}
      <div className="border-t border-slate-100 pt-4">
        <QuietLabel>Authorized work</QuietLabel>
        {authorizedWork.approvedScopeLabel ? (
          <p className="mt-1.5 text-sm font-medium leading-snug text-slate-900 [overflow-wrap:anywhere]">
            {authorizedWork.approvedScopeLabel}
          </p>
        ) : authorizedWork.approvedChangesLabel ? (
          // Authorized changes still count as authorized work when base
          // line-level scope cannot be projected yet — never contradict.
          null
        ) : (
          <p className="mt-1.5 text-sm text-slate-400">No authorized scope on file</p>
        )}
        {authorizedWork.approvedChangesLabel ? (
          <p
            className={`text-sm [overflow-wrap:anywhere] ${
              authorizedWork.approvedScopeLabel
                ? "mt-1 text-slate-600"
                : "mt-1.5 font-medium leading-snug text-slate-900"
            }`}
          >
            {authorizedWork.approvedChangesLabel}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {authorizedWork.measurementSummary ? (
            <span>{authorizedWork.measurementSummary}</span>
          ) : null}
          {authorizedWork.measurementSummary && authorizedWork.accessNotes ? (
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
          ) : null}
          {authorizedWork.accessNotes ? (
            <span className="[overflow-wrap:anywhere]">{authorizedWork.accessNotes}</span>
          ) : null}
        </div>
      </div>

      {/* Assigned / open tasks */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <QuietLabel>Tasks</QuietLabel>
          {!quietPhotoHint && model.photoCount > 0 ? (
            <span className="text-xs text-slate-400">{model.photoCount} photos</span>
          ) : null}
        </div>
        {openTasks.length === 0 && tasks.length === 0 ? (
          <p className="mt-1.5 text-sm text-slate-400">No tasks yet</p>
        ) : openTasks.length === 0 ? (
          <p className="mt-1.5 text-sm text-slate-400">No open tasks</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {openTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="min-w-0 font-medium text-slate-900 [overflow-wrap:anywhere]">
                  {task.title}
                </span>
                <span className="shrink-0 text-right text-xs leading-5 text-slate-500">
                  <span className="block">{task.assigneeLabel}</span>
                  {task.dueOn ? (
                    <span className="block text-slate-400">{task.dueOn}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {warning ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warning}
        </p>
      ) : null}
    </div>
  );
}
