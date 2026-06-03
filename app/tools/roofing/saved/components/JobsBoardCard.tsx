"use client";

import type { JobsBoardCardModel } from "../jobsBoardUtils";
import { signalToneClass, stageAgeToneClass } from "../jobsBoardUtils";

type JobsBoardCardProps = {
  model: JobsBoardCardModel;
  onOpen: () => void;
};

export default function JobsBoardCard({ model, onOpen }: JobsBoardCardProps) {
  const secondarySignals = [model.depositSignal, model.proposalSignal, model.measurementSignal].filter(
    Boolean
  ) as NonNullable<
    JobsBoardCardModel["depositSignal"] | JobsBoardCardModel["proposalSignal"] | JobsBoardCardModel["measurementSignal"]
  >[];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-snug text-slate-900 group-hover:text-blue-700">
            {model.customerName}
          </div>
          {model.address ? (
            <div className="mt-1 truncate text-xs leading-snug text-slate-500">{model.address}</div>
          ) : null}
        </div>
        {model.valueLabel ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{model.valueLabel}</span>
        ) : null}
      </div>

      {model.scheduledDateLabel ? (
        <div className="mt-2 text-xs text-slate-600">{model.scheduledDateLabel}</div>
      ) : null}

      {model.blockers.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {model.blockers.map((b) => (
            <span
              key={b}
              className="inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800 ring-1 ring-inset ring-rose-200/70"
            >
              {b}
            </span>
          ))}
        </div>
      ) : null}

      {secondarySignals.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {secondarySignals.map((sig) => (
            <span
              key={sig.label}
              className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${signalToneClass(sig.tone)}`}
            >
              {sig.label}
            </span>
          ))}
        </div>
      ) : null}

      {model.stageAge ? (
        <div className="mt-3 border-t border-slate-100 pt-2.5">
          <span className={`text-[11px] font-medium ${stageAgeToneClass(model.stageAgeTone)}`}>
            {model.stageAge}
          </span>
        </div>
      ) : null}
    </article>
  );
}
