"use client";

import { useState } from "react";
import { buttonClass } from "@/app/components/ui/buttonStyles";
import {
  JOB_CARD_CLOSEOUT_COPY_FAILED,
  JOB_CARD_CLOSEOUT_COPY_LINK_CTA,
  JOB_CARD_CLOSEOUT_HEADING,
  JOB_CARD_CLOSEOUT_HIDE_CTA,
  JOB_CARD_CLOSEOUT_OPEN_PAYMENTS_CTA,
  JOB_CARD_CLOSEOUT_REVIEW_CTA,
  describeCloseoutLinkCopied,
  type JobCardCloseoutViewModel,
} from "@/app/lib/jobCardCloseoutViewModel";

type JobCardCloseoutSummaryProps = {
  model: JobCardCloseoutViewModel;
  jobId: string;
  /** `proposal_author` only; the server enforces the same capability. */
  canShareCustomerLink: boolean;
  /** Rendered first in a completed job's Overview. */
  leading?: boolean;
  /** Present only when a balance remains. */
  onOpenPayments?: () => void;
};

export default function JobCardCloseoutSummary({
  model,
  jobId,
  canShareCustomerLink,
  leading = false,
  onOpenPayments,
}: JobCardCloseoutSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState<
    { kind: "copied"; expiresAt: string | null } | { kind: "failed" } | null
  >(null);

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
        | { ok?: boolean; publicUrl?: string; expiresAt?: string | null }
        | null;
      if (!response.ok || data?.ok !== true || typeof data.publicUrl !== "string") {
        setCopyStatus({ kind: "failed" });
        return;
      }
      await navigator.clipboard.writeText(data.publicUrl);
      setCopyStatus({
        kind: "copied",
        expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
      });
    } catch {
      setCopyStatus({ kind: "failed" });
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <section
      className={
        leading
          ? "rounded-xl border border-slate-200 bg-white p-4"
          : "border-t border-slate-100 pt-4"
      }
      data-jobcard-closeout
      data-jobcard-closeout-leading={leading ? "true" : undefined}
      aria-label={JOB_CARD_CLOSEOUT_HEADING}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {JOB_CARD_CLOSEOUT_HEADING}
      </p>
      <p
        className={`mt-1 font-semibold text-slate-900 ${leading ? "text-lg" : "text-sm"}`}
        data-jobcard-closeout-completion
      >
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
              <dd className="shrink-0 whitespace-nowrap tabular-nums text-slate-800">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onOpenPayments ? (
          <button
            type="button"
            className={buttonClass("primary", { size: "sm" })}
            onClick={onOpenPayments}
            data-jobcard-closeout-open-payments
          >
            {JOB_CARD_CLOSEOUT_OPEN_PAYMENTS_CTA}
          </button>
        ) : null}
        <button
          type="button"
          className={buttonClass("secondary", { size: "sm" })}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-jobcard-closeout-review
        >
          {expanded ? JOB_CARD_CLOSEOUT_HIDE_CTA : JOB_CARD_CLOSEOUT_REVIEW_CTA}
        </button>
        {canShareCustomerLink ? (
          <button
            type="button"
            className={buttonClass("secondary", {
              size: "sm",
              className: "disabled:cursor-wait",
            })}
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
          className={`mt-1.5 text-xs ${copyStatus.kind === "copied" ? "text-slate-600" : "text-red-700"}`}
          role="status"
          data-jobcard-closeout-copy-status={copyStatus.kind}
        >
          {copyStatus.kind === "copied"
            ? describeCloseoutLinkCopied(copyStatus.expiresAt)
            : JOB_CARD_CLOSEOUT_COPY_FAILED}
        </p>
      ) : null}
    </section>
  );
}
