import { Lock, MoreHorizontal } from "lucide-react";
import type {
  ProposalBuilderLifecycleActionId,
  ProposalBuilderLifecycleLock,
} from "@/app/lib/proposalBuilderGuidance";
import {
  BUILDER_DISABLED_ACTION,
  BUILDER_PREVIEW_ENABLED_ACTION,
} from "./proposalBuilderConstants";

const HEADER_ACTION_ORDER = ["preview", "send", "sign", "payment"] as const;

type ProposalBuilderDisabledActionsProps = {
  lifecycleLocks?: ProposalBuilderLifecycleLock[] | null;
  onLifecycleAction?: (actionId: ProposalBuilderLifecycleActionId) => void;
  /** Quiet note under More — not a primary Snapshot link. */
  savedPricingDetails?: string | null;
};

export default function ProposalBuilderDisabledActions({
  lifecycleLocks = null,
  onLifecycleAction,
  savedPricingDetails = null,
}: ProposalBuilderDisabledActionsProps) {
  const headerLocks = lifecycleLocks
    ? HEADER_ACTION_ORDER.map((id) =>
        lifecycleLocks.find((lock) => lock.actionId === id)
      ).filter((lock): lock is ProposalBuilderLifecycleLock => Boolean(lock))
    : null;

  const previewLock = headerLocks?.find((lock) => lock.actionId === "preview") ?? null;
  const futureLocks =
    headerLocks?.filter((lock) => lock.actionId !== "preview") ?? [];

  const previewEnabled =
    previewLock != null &&
    (previewLock.state === "ready" || previewLock.state === "attention");
  const previewReason =
    previewLock?.lockedReason ?? previewLock?.unlockSummary ?? "Preview";

  const pricingNote = (savedPricingDetails ?? "").trim();
  const showMore = futureLocks.length > 0 || pricingNote.length > 0;

  return (
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
        className={
          previewEnabled
            ? previewLock?.state === "attention"
              ? `${BUILDER_PREVIEW_ENABLED_ACTION} border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100/80`
              : BUILDER_PREVIEW_ENABLED_ACTION
            : `${BUILDER_DISABLED_ACTION} border-blue-200 bg-blue-50/40 text-blue-400`
        }
        title={
          previewEnabled
            ? previewLock?.state === "attention"
              ? `Contractor review preview — ${previewReason}`
              : "Open customer preview"
            : previewReason
        }
        onClick={() => {
          if (previewEnabled) onLifecycleAction?.("preview");
        }}
      >
        {!previewEnabled ? <Lock className="mr-1 h-3.5 w-3.5" aria-hidden /> : null}
        Preview
      </button>

      {showMore ? (
        <details className="relative" data-builder-future-actions>
          <summary
            className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
            title="More proposal actions"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
            More
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-[16.5rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
            {futureLocks.map((lock) => (
              <button
                key={lock.actionId}
                type="button"
                disabled
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-slate-400"
                title={lock.lockedReason ?? lock.unlockSummary}
              >
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                {lock.label}
              </button>
            ))}
            {pricingNote ? (
              <details
                className="mt-0.5 border-t border-slate-100 px-2.5 py-1.5"
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
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
