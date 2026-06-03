"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type { JobsBoardCardModel } from "../jobsBoardUtils";
import { signalToneClass, stageAgeToneClass } from "../jobsBoardUtils";

type JobsBoardCardProps = {
  model: JobsBoardCardModel;
  onOpen: () => void;
};

export default function JobsBoardCard({ model, onOpen }: JobsBoardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(ev: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

  return (
    <article className="group relative rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 rounded-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {model.showStageLabel ? (
                <span className="mb-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {model.stageLabel}
                </span>
              ) : null}
              <div className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                {model.customerName}
              </div>
            </div>
            {model.valueLabel ? (
              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-600">{model.valueLabel}</span>
            ) : null}
          </div>
          {model.address ? <div className="mt-0.5 truncate text-[11px] text-slate-500">{model.address}</div> : null}
        </button>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-label="Job actions"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <div className="px-3 py-2 text-[10px] text-slate-400" title="Future: move stage, assign, tag">
                Move stage — soon
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${signalToneClass(model.proposalSignal.tone)}`}
        >
          {model.proposalSignal.label}
        </span>
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${signalToneClass(model.measurementSignal.tone)}`}
        >
          {model.measurementSignal.label}
        </span>
      </div>

      {model.blockers.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {model.blockers.map((b) => (
            <span
              key={b}
              className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200/80"
            >
              {b}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px]">
        <span className={`font-medium ${stageAgeToneClass(model.stageAgeTone)}`}>{model.stageAge ?? "—"}</span>
        {model.lastUpdated ? <span className="text-slate-400">Updated {model.lastUpdated}</span> : null}
      </div>

      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
        >
          Open job
        </button>
      </div>
    </article>
  );
}
