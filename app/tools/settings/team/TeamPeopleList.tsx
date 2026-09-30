"use client";

import type { ReactNode } from "react";
import { ChevronRight, Mail } from "lucide-react";

/**
 * Person anchors, not access columns. Identity precedes operational context;
 * sensitive actions stay separate from the in-place relationship region.
 * Mobile uses one shallow relationship guide, never cumulative tree indentation.
 */

export type TeamRowState = "Active" | "Invited" | "Access removed";

export type TeamRowModel = {
  key: string;
  kind: "member" | "invited" | "removed";
  name: string;
  email: string | null;
  self?: boolean;
  owner?: boolean;
  accessLabel: string;
  accessSummary: string | null;
  state: TeamRowState | null;
  stateNote: string | null;
  attention: string | null;
  /** Verified operational counts only; never the directory's zero placeholders. */
  work?: { coordinatorJobs: number; assignedTasks: number } | null;
  onOpen?: () => void;
};

function initials(name: string): string {
  const words = name
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function TeamMonogram({
  name,
  kind,
  size = "md",
}: {
  name: string;
  kind: TeamRowModel["kind"];
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-[12px] sm:h-10 sm:w-10 sm:text-[13px]";
  if (kind === "invited") {
    return (
      <span
        className={`${box} inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400`}
        aria-hidden
      >
        <Mail className="h-4 w-4" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ${
        kind === "removed" ? "bg-slate-50 text-slate-300" : "bg-slate-100 text-slate-600"
      }`}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function StateText({ state, note, attention }: { state: TeamRowState; note: string | null; attention: string | null }) {
  return (
    <span className="block min-w-0 text-right sm:text-left">
      <span
        className={`inline-flex items-center gap-1.5 text-[13px] font-medium sm:text-sm ${
          state === "Invited" ? "text-amber-700" : state === "Access removed" ? "text-slate-400" : "text-slate-600"
        }`}
      >
        {state === "Active" ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> : null}
        {state}
      </span>
      {note ? <span className="mt-0.5 block text-xs text-slate-500">{note}</span> : null}
      {attention ? (
        <span className="mt-0.5 block text-xs text-amber-800" data-company-settings-team-pending-handoff>
          {attention}
        </span>
      ) : null}
    </span>
  );
}

/**
 * A person is the anchor, not a table row or a button around a future crew.
 * Relationship content is a sibling of identity/actions: it can contain direct
 * controls later without nested buttons or moving the workspace into a sheet.
 * No relationship region renders until backed by real data.
 */
export function TeamPersonRow({
  row, selected, children,
}: { row: TeamRowModel; selected: boolean; children?: ReactNode }) {
  const muted = row.kind === "removed";
  const hasWork = row.work && (row.work.coordinatorJobs > 0 || row.work.assignedTasks > 0);
  return (
    <li
      className={`min-w-0 py-5 sm:py-6 ${selected ? "bg-blue-50/40" : ""}`}
      data-company-settings-team-row={row.kind === "member" ? (row.owner ? "owner" : "active") : row.kind}
      data-team-person-anchor
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <TeamMonogram name={row.name} kind={row.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              {row.onOpen ? (
                <button type="button" onClick={row.onOpen}
                  className="-my-2 min-h-[44px] max-w-full rounded py-2 text-left text-[15px] font-semibold text-slate-900 [overflow-wrap:anywhere] hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`View ${row.name}`}>
                  {row.name}
                </button>
              ) : <span className="text-[15px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{row.name}</span>}
              {row.self ? <span className="ml-2 text-xs text-slate-500">You</span> : null}
            </div>
            {row.state ? (
              <div className="flex flex-wrap items-baseline gap-1.5 text-xs text-slate-500">
                <span>FieldDive</span>
                <StateText state={row.state} note={row.stateNote} attention={null} />
              </div>
            ) : null}
          </div>
          <p className={`mt-1 text-sm font-medium ${muted ? "text-slate-500" : "text-slate-700"}`}>{row.accessLabel}</p>
          {row.accessSummary ? <p className="mt-1 text-sm leading-relaxed text-slate-500">{row.accessSummary}</p> : null}
        </div>
      </div>
      {hasWork || children ? (
        <div className="mt-4 min-w-0 border-l border-slate-200 pl-3 sm:ml-5 sm:pl-9" data-team-person-relationships>
          {hasWork ? <TeamWorkSummary work={row.work!} /> : null}
          {children}
        </div>
      ) : null}
      {row.attention ? <p className="mt-3 text-sm text-amber-800 sm:ml-14" data-company-settings-team-pending-handoff>{row.attention}</p> : null}
      {row.onOpen ? (
        <button type="button" onClick={row.onOpen}
          className="mt-1 inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:ml-14">
          {row.kind === "invited" ? "View invitation" : "Details & access"}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

/** These are coordinator/task facts, not onsite responsibility or Crew membership. */
export function TeamWorkSummary({ work }: { work: NonNullable<TeamRowModel["work"]> }) {
  return (
    <div className="space-y-1 text-sm text-slate-700" data-team-current-work>
      {work.coordinatorJobs > 0 ? (
        <p>Coordinator for <span className="font-medium text-slate-900">{work.coordinatorJobs} open {work.coordinatorJobs === 1 ? "job" : "jobs"}</span></p>
      ) : null}
      {work.assignedTasks > 0 ? (
        <p><span className="font-medium text-slate-900">{work.assignedTasks} open {work.assignedTasks === 1 ? "task" : "tasks"}</span> assigned</p>
      ) : null}
    </div>
  );
}

export function TeamPeopleList({
  rows,
  selectedKey,
  testId = "team-list",
}: {
  rows: readonly TeamRowModel[];
  selectedKey: string | null;
  testId?: string;
}) {
  return (
    <ul
      className="min-w-0 divide-y divide-slate-100"
      data-company-settings-team-list={testId}
    >
      {rows.map((row) => (
        <TeamPersonRow key={row.key} row={row} selected={row.key === selectedKey} />
      ))}
    </ul>
  );
}

export function TeamListSkeleton() {
  return (
    <ul
      className="min-w-0 divide-y divide-slate-100"
      data-company-settings-team-loading
      aria-label="Loading team"
    >
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-4 px-4 py-4 sm:px-6">
          <span className="h-9 w-9 animate-pulse rounded-full bg-slate-100 sm:h-10 sm:w-10" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-40 animate-pulse rounded bg-slate-200" />
            <span className="block h-3 w-full max-w-56 animate-pulse rounded bg-slate-100" />
          </span>
        </li>
      ))}
    </ul>
  );
}
