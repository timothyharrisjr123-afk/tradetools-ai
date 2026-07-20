"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Link2, Loader2 } from "lucide-react";
import {
  buildPublicReviewReadinessViewModel,
  hasPublicProposalSentSnapshot,
  PUBLIC_REVIEW_PANEL_INTRO,
  PUBLIC_REVIEW_PANEL_TITLE,
  PUBLIC_REVIEW_REVIEW_LINK_DISCLAIMER,
  type PublicReviewSessionLink,
} from "@/app/lib/proposalPublicReviewReadiness";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";
import { BUILDER_CARD, BUILDER_DISABLED_ACTION } from "../builder/proposalBuilderConstants";

type ProposalCustomerPreviewPublicAccessPanelProps = {
  jobId: string;
  proposalId: string;
  proposal: ProposalRecord | null;
  loading: boolean;
  /** Block 5 Roofr-first Preview — hide Signature/PDF/Payment staging rows. */
  hideDeferredActions?: boolean;
};

const PRIMARY_ACTION =
  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-300 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto";

const SECONDARY_ACTION =
  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 sm:w-auto";

function formatSentSnapshotLabel(ready: boolean): string {
  return ready ? "Ready" : "Not created yet";
}

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

  return (
    <section
      className={`${BUILDER_CARD} space-y-5 border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white`}
      aria-label="Customer view readiness"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {PUBLIC_REVIEW_PANEL_TITLE}
        </p>
        <p className="text-sm text-slate-700">{PUBLIC_REVIEW_PANEL_INTRO}</p>
        <p className="text-sm text-slate-500">{PUBLIC_REVIEW_REVIEW_LINK_DISCLAIMER}</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200/80 bg-white px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sent snapshot
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {formatSentSnapshotLabel(hasSentSnapshot)}
          </dd>
        </div>
        <div className="rounded-md border border-slate-200/80 bg-white px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Review link
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {formatReviewLinkLabel(loading, sessionLink != null, hasSentSnapshot)}
          </dd>
        </div>
      </dl>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">{readiness.title}</h3>
        <p className="text-sm text-slate-600">{readiness.body}</p>
        {readiness.mintErrorMessage ? (
          <p className="text-sm text-red-700" role="alert">
            {readiness.mintErrorMessage}
          </p>
        ) : null}
        {copyMessage ? <p className="text-sm text-emerald-700">{copyMessage}</p> : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className={PRIMARY_ACTION}
          disabled={!readiness.canCreateReviewLink || panelBusy}
          aria-disabled={!readiness.canCreateReviewLink || panelBusy}
          onClick={() => void handleCreateReviewLink()}
        >
          {mintPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Create review link
        </button>
        <button
          type="button"
          className={SECONDARY_ACTION}
          disabled={!readiness.canOpenCustomerView || panelBusy}
          aria-disabled={!readiness.canOpenCustomerView || panelBusy}
          onClick={handleOpenCustomerView}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open customer view
        </button>
        <button
          type="button"
          className={SECONDARY_ACTION}
          disabled={!readiness.canCopyReviewLink || panelBusy}
          aria-disabled={!readiness.canCopyReviewLink || panelBusy}
          onClick={() => void handleCopyReviewLink()}
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Copy review link
        </button>
      </div>

      {!hideDeferredActions ? (
        <div className="space-y-2 border-t border-slate-200/80 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Coming later
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {readiness.deferredActions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled
                aria-disabled="true"
                className={`${BUILDER_DISABLED_ACTION} w-full sm:w-auto`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
