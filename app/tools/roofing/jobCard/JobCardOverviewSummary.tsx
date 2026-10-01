"use client";

import type { ReactNode } from "react";
import {
  Archive,
  CalendarDays,
  CircleCheck,
  CircleCheckBig,
  CircleHelp,
  CirclePause,
  ClipboardList,
  FileCheck,
  FileText,
  Hammer,
  type LucideIcon,
} from "lucide-react";
import { SURFACE_TONED } from "@/app/components/ui/surfaceStyles";
import type {
  JobCardOverviewFactKey,
  JobCardOverviewStateView,
} from "@/app/lib/jobCardOverviewComposition";
import {
  jobCardOverviewHeroLook,
  type JobCardOverviewHeroIcon,
  type JobCardOverviewHeroTone,
  type JobCardOverviewTimelineEntry,
} from "@/app/lib/jobCardOverviewPresentation";
import {
  OVERVIEW_FACT_LABEL,
  OVERVIEW_FACT_META,
  OVERVIEW_FACT_TEXT,
  OVERVIEW_FACT_TEXT_QUIET,
  OVERVIEW_GROUP_HEADING,
  OVERVIEW_STATE_TITLE,
} from "./jobCardOverviewStyles";

const HERO_ICONS: Record<JobCardOverviewHeroIcon, LucideIcon> = {
  calendar: CalendarDays,
  work: Hammer,
  approved: CircleCheck,
  accepted: FileCheck,
  proposal: FileText,
  intake: ClipboardList,
  hold: CirclePause,
  closed: Archive,
  complete: CircleCheckBig,
  unknown: CircleHelp,
};

const HERO_SURFACE: Record<JobCardOverviewHeroTone, string> = {
  active: "border-blue-100 bg-blue-50/60",
  hold: "border-amber-100 bg-amber-50/60",
  quiet: "border-slate-200/80 bg-slate-50/70",
};

const HERO_ICON: Record<JobCardOverviewHeroTone, string> = {
  active: "bg-blue-100/80 text-blue-600",
  hold: "bg-amber-100/80 text-amber-700",
  quiet: "bg-white text-slate-500 ring-1 ring-slate-200",
};

/** Lead and Crew live in the paired people row, never inside the hero. */
const PEOPLE_FACTS = new Set<JobCardOverviewFactKey>(["lead", "crew"]);

function HeroTimeline({ entries }: { entries: readonly JobCardOverviewTimelineEntry[] }) {
  return (
    <ol className="space-y-3" data-jobcard-overview-timeline>
      {entries.map((entry, index) => (
        <li
          key={entry.key}
          className="relative flex items-center gap-3"
          data-jobcard-overview-timeline-entry={entry.key}
          aria-current={entry.current ? "date" : undefined}
        >
          {index < entries.length - 1 ? (
            <span className="absolute left-[3.5px] top-1/2 h-[calc(100%+0.75rem)] w-px bg-slate-300" aria-hidden />
          ) : null}
          <span
            className={`relative h-2 w-2 shrink-0 rounded-full ${
              entry.current ? "bg-blue-600 ring-4 ring-blue-100" : "bg-slate-300"
            }`}
            aria-hidden
          />
          <span
            className={`w-14 shrink-0 text-[13px] ${
              entry.current ? "font-medium text-blue-600" : "text-slate-500"
            }`}
          >
            {entry.dateLabel}
          </span>
          <span
            className={`min-w-0 text-sm [overflow-wrap:anywhere] ${
              entry.current ? "font-medium text-slate-900" : "text-slate-700"
            }`}
          >
            {entry.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StateHero({
  state,
  stateFactActions,
  timeline,
  primaryAction,
}: {
  state: JobCardOverviewStateView;
  stateFactActions: Partial<Record<JobCardOverviewFactKey, ReactNode>>;
  timeline: readonly JobCardOverviewTimelineEntry[];
  primaryAction: ReactNode;
}) {
  const look = jobCardOverviewHeroLook(state.kind);
  const Icon = HERO_ICONS[look.icon];
  const facts = state.facts.filter((fact) => !PEOPLE_FACTS.has(fact.key));
  const planned = facts.find((fact) => fact.key === "planned") ?? null;
  const others = facts.filter((fact) => fact.key !== "planned");

  return (
    <section
      data-jobcard-overview-situation
      data-jobcard-overview-kind={state.kind}
      data-jobcard-overview-hero={look.tone}
      className={`rounded-2xl border px-5 py-5 sm:px-6 ${HERO_SURFACE[look.tone]}`}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
        <div data-jobcard-overview-operational className="flex min-w-0 items-start gap-4 md:max-w-[24rem] md:flex-[0_1_auto]">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${HERO_ICON[look.tone]}`}
            aria-hidden
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 space-y-1 pt-0.5">
            <h3
              className="text-xl font-bold leading-tight tracking-tight text-slate-950 [overflow-wrap:anywhere]"
              data-jobcard-overview-state-title
            >
              {state.title}
            </h3>
            {planned ? (
              <div data-jobcard-overview-fact="planned">
                <p
                  className={`text-[15px] leading-snug [overflow-wrap:anywhere] ${
                    planned.quiet ? "text-slate-500" : "font-medium text-slate-800"
                  }`}
                >
                  {planned.text}
                </p>
                {planned.meta ? <p className="text-[13px] text-slate-500">{planned.meta}</p> : null}
                {stateFactActions.planned ?? null}
              </div>
            ) : null}
            {others.map((fact) => (
              <div key={fact.key} data-jobcard-overview-fact={fact.key}>
                <p className={`text-sm leading-snug ${fact.quiet ? "text-slate-500" : "text-slate-800"}`}>
                  <span className="text-slate-500">{fact.label} · </span>
                  {fact.text}
                </p>
                {stateFactActions[fact.key] ?? null}
              </div>
            ))}
            {state.notes.map((note) => (
              <p key={note} className="text-sm leading-snug text-slate-600">
                {note}
              </p>
            ))}
          </div>
        </div>
        {timeline.length > 0 ? (
          <div className="min-w-0 flex-1 border-t border-slate-200/70 pt-4 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <HeroTimeline entries={timeline} />
          </div>
        ) : (
          <div className="hidden md:block md:flex-1" aria-hidden />
        )}
        {primaryAction ? (
          <div className="shrink-0 empty:hidden max-[1199px]:has-[>.hidden:only-child]:hidden md:ml-auto">
            {primaryAction}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type JobCardOverviewSummaryProps = {
  /** Structured current situation; null while the stage is still loading. */
  state?: JobCardOverviewStateView | null;
  /** Contextual controls rendered with a state fact (Assign lead, Change plan). */
  stateFactActions?: Partial<Record<JobCardOverviewFactKey, ReactNode>>;
  paymentStatusLabel?: string | null;
  /** Money summary when authorized — never fabricate $0. */
  financialSummary?: ReactNode;
  /** When true, hide commercial rows (field-restricted viewers). */
  suppressCommercial?: boolean;
  fieldBrief?: ReactNode;
  /** Situation-area primary lifecycle CTA (desktop/inline). */
  primaryAction?: ReactNode;
  /** Quiet entry into the Activity destination. */
  recentActivitySummary?: ReactNode;
  /** Rendered before the state region (completed jobs: closeout/payment). */
  leadingSection?: ReactNode;
  /** Callers without a field brief (estimator view, review harnesses) only. */
  proposalLabel?: string | null;
  measurementLabel?: string | null;
  /** Canonical Overview only; legacy estimator/harness presentations stay unchanged. */
  operationalLayout?: boolean;
  /** Operational layout: dated hero timeline (scheduled/in production only). */
  timeline?: readonly JobCardOverviewTimelineEntry[];
  /** Operational layout: the paired Coordinator + Crew row under the hero. */
  people?: ReactNode;
};

function DetailRow({ label, text }: { label: string; text: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-800">{text}</span>
    </div>
  );
}

export default function JobCardOverviewSummary({
  state = null,
  stateFactActions = {},
  paymentStatusLabel = null,
  financialSummary = null,
  suppressCommercial = false,
  fieldBrief = null,
  primaryAction = null,
  recentActivitySummary = null,
  leadingSection = null,
  proposalLabel = null,
  measurementLabel = null,
  operationalLayout = false,
  timeline = [],
  people = null,
}: JobCardOverviewSummaryProps) {
  const showMoney = !suppressCommercial && Boolean(financialSummary || paymentStatusLabel);
  const detailRows = fieldBrief
    ? []
    : [
        ...(!suppressCommercial && proposalLabel
          ? [{ label: "Proposal", text: proposalLabel, attr: "proposal" }]
          : []),
        ...(measurementLabel
          ? [{ label: "Measurement", text: measurementLabel, attr: "measurement" }]
          : []),
      ];

  if (operationalLayout) {
    return (
      <div className="space-y-3" data-jobcard-overview-truth data-jobcard-overview-layout="operational">
        {leadingSection}

        {/* 1. Current situation hero: state, timing, dated timeline, next lifecycle action */}
        {state ? (
          <StateHero
            state={state}
            stateFactActions={stateFactActions}
            timeline={timeline}
            primaryAction={primaryAction}
          />
        ) : primaryAction ? (
          <section data-jobcard-overview-situation className="space-y-3">
            {primaryAction}
          </section>
        ) : null}

        {/* 2. Coordinator + Crew: related, separate */}
        {people}

        {/* 3. Authorized work and the Field Brief */}
        {fieldBrief ? (
          <section data-jobcard-overview-brief className="min-w-0">
            {fieldBrief}
          </section>
        ) : null}

        {showMoney ? (
          <section data-jobcard-overview-financial className="px-1">
            <h3 className="sr-only">Payments</h3>
            {financialSummary ?? (
              <p className="text-sm text-slate-700" data-jobcard-overview-payment>
                {paymentStatusLabel}
              </p>
            )}
          </section>
        ) : null}

        {/* 4. Recent activity, collapsed; Activity stays the full history */}
        {recentActivitySummary}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-jobcard-overview-truth>
      {leadingSection}

      {/* 1. Current situation, its timing/responsibility, and the next lifecycle action */}
      <section
        data-jobcard-overview-situation
        data-jobcard-overview-kind={state?.kind}
        className={
          state
            ? `rounded-lg ${SURFACE_TONED} px-4 py-4 sm:px-5 min-[1200px]:flex min-[1200px]:items-start min-[1200px]:justify-between min-[1200px]:gap-8`
            : primaryAction
              ? "space-y-3"
              : "hidden"
        }
      >
        {state ? (
          <div data-jobcard-overview-operational className="min-w-0 space-y-3">
            <div className="space-y-1">
              <h3 className={OVERVIEW_STATE_TITLE} data-jobcard-overview-state-title>
                {state.title}
              </h3>
              {state.notes.map((note) => (
                <p key={note} className="text-sm leading-snug text-slate-600">
                  {note}
                </p>
              ))}
            </div>
            {state.facts.length > 0 ? (
              <dl
                className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-10"
                data-jobcard-overview-facts
              >
                {state.facts.map((fact) => (
                  <div
                    key={fact.key}
                    className={`min-w-0 ${fact.key === "crew" ? "col-span-2 sm:col-span-1" : ""}`}
                    data-jobcard-overview-fact={fact.key}
                  >
                    <dt className={OVERVIEW_FACT_LABEL}>{fact.label}</dt>
                    <dd
                      className={`${fact.quiet ? OVERVIEW_FACT_TEXT_QUIET : OVERVIEW_FACT_TEXT} [overflow-wrap:anywhere]`}
                    >
                      {fact.text}
                    </dd>
                    {fact.meta ? <dd className={OVERVIEW_FACT_META}>{fact.meta}</dd> : null}
                    {stateFactActions[fact.key] ? (
                      <dd>{stateFactActions[fact.key]}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
        {primaryAction}
      </section>

      {/* 2. Work context leads; money supports it (side by side on wide screens) */}
      {fieldBrief || showMoney ? (
        <div
          className={
            fieldBrief && showMoney
              ? "space-y-6 min-[1200px]:grid min-[1200px]:grid-cols-[minmax(0,46rem)_minmax(15rem,20rem)] min-[1200px]:justify-between min-[1200px]:gap-x-12 min-[1200px]:space-y-0"
              : "space-y-6"
          }
        >
          {fieldBrief ? (
            <section data-jobcard-overview-brief className="min-w-0 max-w-[46rem]">
              {fieldBrief}
            </section>
          ) : null}
          {showMoney ? (
            <section
              data-jobcard-overview-financial
              className={`space-y-2 *:max-w-sm ${fieldBrief ? "border-t border-slate-100 pt-5 min-[1200px]:border-t-0 min-[1200px]:pt-0 min-[1200px]:*:max-w-none" : ""}`}
            >
              <h3 className={OVERVIEW_GROUP_HEADING}>Payments</h3>
              {financialSummary ?? (
                <p className="text-sm text-slate-700" data-jobcard-overview-payment>
                  {paymentStatusLabel}
                </p>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {detailRows.length > 0 ? (
        <section className="space-y-2 border-t border-slate-100 pt-4" data-jobcard-overview-details>
          {detailRows.map((row) => (
            <DetailRow
              key={row.attr}
              label={row.label}
              text={
                row.attr === "measurement" ? (
                  <span data-jobcard-overview-measurement>{row.text}</span>
                ) : (
                  row.text
                )
              }
            />
          ))}
        </section>
      ) : null}

      {/* 3. History lives in the Activity destination */}
      {recentActivitySummary}
    </div>
  );
}
