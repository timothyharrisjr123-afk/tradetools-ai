"use client";

import type { RevisionChangeSummaryView } from "@/app/lib/proposalRevisionChangeSummary";

type ProposalPreviewChangeSummaryProps = {
  summary: RevisionChangeSummaryView;
};

export default function ProposalPreviewChangeSummary({
  summary,
}: ProposalPreviewChangeSummaryProps) {
  const collapsed = summary.mode === "sent_record";

  const body = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p
          className="text-[12.5px] font-semibold text-slate-700"
          data-preview-change-summary-title
        >
          {summary.title}
        </p>
        {summary.hasChanges ? (
          <p
            className="text-[12px] text-slate-500"
            data-preview-change-summary-count
          >
            {summary.countLabel}
          </p>
        ) : null}
      </div>
      {summary.hasChanges ? (
        <ul
          className="mt-1.5 space-y-0.5 text-[12.5px] leading-snug text-slate-600"
          data-preview-change-summary-facts
        >
          {summary.facts.map((fact) => (
            <li key={`${fact.kind}:${fact.text}`} data-preview-change-summary-fact={fact.kind}>
              {fact.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12.5px] text-slate-500" data-preview-change-summary-empty>
          {summary.countLabel}
        </p>
      )}
    </>
  );

  if (collapsed) {
    return (
      <details
        className="rounded-xl border border-slate-200/70 bg-white/90 px-3.5 py-2.5"
        data-preview-change-summary
        data-preview-change-summary-mode={summary.mode}
      >
        <summary
          className="cursor-pointer text-[12.5px] font-semibold text-slate-600"
          data-preview-change-summary-title
        >
          {summary.title}
          <span className="ml-2 font-medium text-slate-400" data-preview-change-summary-count>
            {summary.countLabel}
          </span>
        </summary>
        {summary.hasChanges ? (
          <ul
            className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-[12.5px] leading-snug text-slate-600"
            data-preview-change-summary-facts
          >
            {summary.facts.map((fact) => (
              <li key={`${fact.kind}:${fact.text}`} data-preview-change-summary-fact={fact.kind}>
                {fact.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-slate-500" data-preview-change-summary-empty>
            {summary.countLabel}
          </p>
        )}
      </details>
    );
  }

  return (
    <section
      className="rounded-xl border border-slate-200/70 bg-white/90 px-3.5 py-2.5"
      data-preview-change-summary
      data-preview-change-summary-mode={summary.mode}
    >
      {body}
    </section>
  );
}
