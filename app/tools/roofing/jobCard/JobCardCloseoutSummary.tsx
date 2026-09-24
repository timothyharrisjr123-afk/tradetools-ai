"use client";

import { useState } from "react";
import {
  JOB_CARD_CLOSEOUT_COPIED,
  JOB_CARD_CLOSEOUT_COPY_FAILED,
  JOB_CARD_CLOSEOUT_COPY_LINK_CTA,
  JOB_CARD_CLOSEOUT_HEADING,
  JOB_CARD_CLOSEOUT_HIDE_CTA,
  JOB_CARD_CLOSEOUT_REVIEW_CTA,
  type JobCardCloseoutViewModel,
} from "@/app/lib/jobCardCloseoutViewModel";

type JobCardCloseoutSummaryProps = {
  model: JobCardCloseoutViewModel;
  jobId: string;
  /** `proposal_author` only; the server enforces the same capability. */
  canShareCustomerLink: boolean;
};

export default function JobCardCloseoutSummary({
  model,
  jobId,
  canShareCustomerLink,
}: JobCardCloseoutSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);

  async function copyCustomerLink() {
    if (copyBusy) return;
    setCopyBusy(true);
    setCopyStatus(null);
    try {
      const response = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/customer-record-link`,
        { method: "POST" }
      );
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; publicUrl?: string }
        | null;
      if (!response.ok || data?.ok !== true || typeof data.publicUrl !== "string") {
        setCopyStatus("failed");
        return;
      }
      await navigator.clipboard.writeText(data.publicUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <section
      className="border-t border-slate-100 pt-4"
      data-jobcard-closeout
      aria-label={JOB_CARD_CLOSEOUT_HEADING}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {JOB_CARD_CLOSEOUT_HEADING}
      </p>
      <p className="mt-1 text-sm font-semibold text-emerald-700" data-jobcard-closeout-completion>
        {model.completionLabel}
      </p>
      <p className="text-sm text-slate-700" data-jobcard-closeout-balance>
        {model.balanceLabel}
      </p>

      {expanded ? (
        <dl className="mt-3 space-y-1 text-sm" data-jobcard-closeout-rows>
          {model.rows.map((row) => (
            <div key={row.key} className="flex min-w-0 items-baseline justify-between gap-4">
              <dt className="text-slate-500">{row.label}</dt>
              <dd className="shrink-0 tabular-nums text-slate-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-jobcard-closeout-review
        >
          {expanded ? JOB_CARD_CLOSEOUT_HIDE_CTA : JOB_CARD_CLOSEOUT_REVIEW_CTA}
        </button>
        {canShareCustomerLink ? (
          <button
            type="button"
            className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
            onClick={() => void copyCustomerLink()}
            disabled={copyBusy}
            aria-busy={copyBusy || undefined}
            data-jobcard-closeout-copy-link
          >
            {JOB_CARD_CLOSEOUT_COPY_LINK_CTA}
          </button>
        ) : null}
      </div>
      {copyStatus ? (
        <p
          className={`mt-1.5 text-xs ${copyStatus === "copied" ? "text-slate-600" : "text-red-700"}`}
          role="status"
        >
          {copyStatus === "copied" ? JOB_CARD_CLOSEOUT_COPIED : JOB_CARD_CLOSEOUT_COPY_FAILED}
        </p>
      ) : null}
    </section>
  );
}
