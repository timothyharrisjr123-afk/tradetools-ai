"use client";

import type { JobCardIncludedItemSummary } from "./jobCardProposalSetup";
import { JOB_CARD_INCLUDED_REVIEW_NOTE } from "./jobCardProposalSetup";

type JobCardProposalIncludedReviewProps = {
  open: boolean;
  packageLabel: string | null;
  items: readonly JobCardIncludedItemSummary[];
  fixTemplateHref: string | null;
  onClose: () => void;
  onFixTemplate: (href: string) => void;
};

export default function JobCardProposalIncludedReview({
  open,
  packageLabel,
  items,
  fixTemplateHref,
  onClose,
  onFixTemplate,
}: JobCardProposalIncludedReviewProps) {
  if (!open) return null;

  return (
    <div
      className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
      data-jobcard-included-review
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-slate-800">
            Included items
            {packageLabel ? (
              <span className="font-medium text-slate-500"> · {packageLabel}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {items.length} item{items.length === 1 ? "" : "s"} on this package
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Hide
        </button>
      </div>

      {items.length > 0 ? (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[11px] text-slate-700">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-2 border-b border-slate-100 py-1 last:border-0"
            >
              <span className="min-w-0">{item.label}</span>
              {item.linkStatus !== "linked" ? (
                <span className="shrink-0 text-[10px] font-medium text-amber-800">
                  Needs attention
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">No items on this package yet.</p>
      )}

      <p className="mt-2 text-[10px] leading-snug text-slate-500">
        {JOB_CARD_INCLUDED_REVIEW_NOTE}
      </p>

      {fixTemplateHref ? (
        <button
          type="button"
          onClick={() => onFixTemplate(fixTemplateHref)}
          className="mt-2 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Edit template
        </button>
      ) : null}
    </div>
  );
}
