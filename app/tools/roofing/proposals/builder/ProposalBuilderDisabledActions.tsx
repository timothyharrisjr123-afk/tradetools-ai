import { Lock, MoreHorizontal } from "lucide-react";
import type {
  ProposalBuilderLifecycleActionId,
  ProposalBuilderLifecycleLock,
} from "@/app/lib/proposalBuilderGuidance";
import {
  BUILDER_CUSTOMER_REVIEW_LABEL,
  BUILDER_DISABLED_ACTION,
  BUILDER_PREVIEW_ENABLED_ACTION,
} from "./proposalBuilderConstants";

type ProposalBuilderDisabledActionsProps = {
  lifecycleLocks?: ProposalBuilderLifecycleLock[] | null;
  onLifecycleAction?: (actionId: ProposalBuilderLifecycleActionId) => void;
  /** Quiet note under More — not a primary Snapshot link. */
  savedPricingDetails?: string | null;
};

/**
 * Customer review is the only primary Builder action. More stays quiet —
 * saved pricing only (no locked lifecycle clutter, no Send).
 */
export default function ProposalBuilderDisabledActions({
  lifecycleLocks = null,
  onLifecycleAction,
  savedPricingDetails = null,
}: ProposalBuilderDisabledActionsProps) {
  const previewLock =
    lifecycleLocks?.find((lock) => lock.actionId === "preview") ?? null;

  const previewEnabled =
    previewLock != null &&
    (previewLock.state === "ready" || previewLock.state === "attention");
  const previewReason =
    previewLock?.lockedReason ?? previewLock?.unlockSummary ?? BUILDER_CUSTOMER_REVIEW_LABEL;

  const pricingNote = (savedPricingDetails ?? "").trim();
  const showMore = pricingNote.length > 0;

  return (
    <div data-builder-preview-handoff>
      <div
        className="flex flex-wrap items-center justify-end gap-2"
        aria-label="Proposal actions"
        data-builder-primary-actions
      >
        <button
          type="button"
          disabled={!previewEnabled}
          aria-disabled={!previewEnabled}
          data-builder-preview-action
          data-builder-customer-review-action
          className={
            previewEnabled
              ? BUILDER_PREVIEW_ENABLED_ACTION
              : `${BUILDER_DISABLED_ACTION} min-h-[44px] border-blue-200 bg-blue-50/40 px-4 text-blue-400`
          }
          title={previewEnabled ? BUILDER_CUSTOMER_REVIEW_LABEL : previewReason}
          onClick={() => {
            if (previewEnabled) onLifecycleAction?.("preview");
          }}
        >
          {!previewEnabled ? (
            <Lock className="mr-1 h-3.5 w-3.5" aria-hidden />
          ) : null}
          {BUILDER_CUSTOMER_REVIEW_LABEL}
        </button>

        {showMore ? (
          <details className="relative" data-builder-future-actions>
            <summary
              className="flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center justify-center gap-1 rounded-lg border border-transparent px-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 [&::-webkit-details-marker]:hidden"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
              More
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-[15rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              <details
                className="px-2.5 py-1.5"
                data-builder-saved-pricing-details
              >
                <summary className="cursor-pointer list-none text-[11px] font-medium text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
                  Saved pricing details
                </summary>
                <p
                  className="mt-1.5 text-[11px] leading-snug text-slate-500"
                  data-builder-snapshot-frozen-helper
                >
                  {pricingNote}
                </p>
              </details>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
