"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Link2, Loader2, ShieldCheck } from "lucide-react";
import {
  buildPublicReviewReadinessViewModel,
  hasPublicProposalSentSnapshot,
  type PublicReviewSessionLink,
} from "@/app/lib/proposalPublicReviewReadiness";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";

type ProposalCustomerPreviewPublicAccessPanelProps = {
  jobId: string;
  proposalId: string;
  proposal: ProposalRecord | null;
  loading: boolean;
  /** Block 5 Roofr-first Preview — hide Signature/PDF/Payment staging rows. */
  hideDeferredActions?: boolean;
  /** Flatten outer card when mounted inside the Preview command surface. */
  embedded?: boolean;
};

const PRIMARY_ACTION =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto";

const SECONDARY_ACTION =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:w-auto";

function formatReviewLinkLabel(
  loading: boolean,
  hasSessionLink: boolean,
  hasSentSnapshot: boolean
): string {
  if (loading) return "Checking…";
  if (hasSessionLink) return "Ready";
  if (hasSentSnapshot) return "Not created";
  return "Not created";
}

export default function ProposalCustomerPreviewPublicAccessPanel({
  jobId,
  proposalId,
  proposal,
  loading,
  hideDeferredActions = false,
  embedded = false,
}: ProposalCustomerPreviewPublicAccessPanelProps) {
  const [sessionLink, setSessionLink] = useState<PublicReviewSessionLink | null>(null);
  const [mintPending, setMintPending] = useState(false);
  const [mintError, setMintError] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const hasSentSnapshot = proposal ? hasPublicProposalSentSnapshot(proposal) : false;

  const readiness = useMemo(
    () =>
      buildPublicReviewReadinessViewModel({
        loading,
        hasSentSnapshot,
        sessionLink,
        mintError,
      }),
    [hasSentSnapshot, loading, mintError, sessionLink]
  );

  async function handleCreateReviewLink() {
    if (!readiness.canCreateReviewLink || mintPending) {
      return;
    }

    setMintPending(true);
    setMintError(false);
    setCopyMessage(null);

    try {
      const response = await fetch("/api/proposals/public-review-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, jobId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; publicUrl: string; tokenPrefix: string; expiresAt: string }
        | { ok: false; message?: string }
        | null;

      if (!response.ok || !payload || payload.ok !== true || !payload.publicUrl) {
        setMintError(true);
        setSessionLink(null);
        return;
      }

      setSessionLink({
        publicUrl: payload.publicUrl,
        tokenPrefix: payload.tokenPrefix,
        expiresAt: payload.expiresAt,
      });
      setMintError(false);
    } catch {
      setMintError(true);
      setSessionLink(null);
    } finally {
      setMintPending(false);
    }
  }

  function handleOpenCustomerView() {
    if (!sessionLink?.publicUrl || !readiness.canOpenCustomerView) {
      return;
    }

    window.open(sessionLink.publicUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCopyReviewLink() {
    if (!sessionLink?.publicUrl || !readiness.canCopyReviewLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sessionLink.publicUrl);
      setCopyMessage("Review link copied.");
    } catch {
      setCopyMessage("Could not copy the review link.");
    }
  }

  const panelBusy = loading || mintPending;
  const shellClass = embedded
    ? "space-y-5"
    : "space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const linkStatus = formatReviewLinkLabel(loading, sessionLink != null, hasSentSnapshot);

  return (
    <section className={shellClass} aria-label="Customer proposal link" data-preview-link-panel>
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900">Customer proposal link</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          Create a private link when you are ready to preview or share this proposal.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.6)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Link2 className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900">Proposal link</p>
              <p className="mt-0.5 text-[12.5px] text-slate-500">
                {sessionLink ? "Ready to share" : "Not created yet"}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              sessionLink ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
            data-preview-link-status
          >
            {linkStatus}
          </span>
        </div>

        {readiness.mintErrorMessage ? (
          <p className="mt-3 text-[13px] text-red-700" role="alert">
            The proposal link could not be created. Review the proposal and try again.
          </p>
        ) : null}
        {copyMessage ? <p className="mt-3 text-[13px] text-emerald-700">{copyMessage}</p> : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!sessionLink ? (
          <button
            type="button"
            className={PRIMARY_ACTION}
            disabled={!readiness.canCreateReviewLink || panelBusy}
            aria-disabled={!readiness.canCreateReviewLink || panelBusy}
            onClick={() => void handleCreateReviewLink()}
            data-preview-create-secure-link
          >
            {mintPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Create secure link
          </button>
        ) : null}
        <button
          type="button"
          className={sessionLink ? PRIMARY_ACTION : SECONDARY_ACTION}
          disabled={!readiness.canOpenCustomerView || panelBusy}
          aria-disabled={!readiness.canOpenCustomerView || panelBusy}
          onClick={handleOpenCustomerView}
          data-preview-open-customer-proposal
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open customer proposal
        </button>
        <button
          type="button"
          className={SECONDARY_ACTION}
          disabled={!readiness.canCopyReviewLink || panelBusy}
          aria-disabled={!readiness.canCopyReviewLink || panelBusy}
          onClick={() => void handleCopyReviewLink()}
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Copy link
        </button>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-slate-100/70 px-3.5 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          This link is private. Share it only with the customer and intended recipients.
        </p>
      </div>

      {!hideDeferredActions ? (
        <p className="sr-only">
          {readiness.deferredActions.map((action) => action.label).join(", ")}
        </p>
      ) : null}
    </section>
  );
}
