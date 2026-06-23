import { Lock } from "lucide-react";
import type {
  ProposalBuilderLifecycleActionId,
  ProposalBuilderLifecycleLock,
} from "@/app/lib/proposalBuilderGuidance";
import {
  BUILDER_DISABLED_ACTION,
  BUILDER_PREVIEW_ENABLED_ACTION,
} from "./proposalBuilderConstants";

const FALLBACK_ACTIONS = [
  { id: "preview", label: "Preview" },
  { id: "send", label: "Send" },
  { id: "sign", label: "Sign" },
  { id: "payment", label: "Payment" },
] as const;

const HEADER_ACTION_ORDER = ["preview", "send", "sign", "payment"] as const;

type ProposalBuilderDisabledActionsProps = {
  /** 3J4B7: lifecycle locks from the guidance model (single source of truth). */
  lifecycleLocks?: ProposalBuilderLifecycleLock[] | null;
  /** R17B — invoked when an enabled lifecycle action is clicked. */
  onLifecycleAction?: (actionId: ProposalBuilderLifecycleActionId) => void;
};

export default function ProposalBuilderDisabledActions({
  lifecycleLocks = null,
  onLifecycleAction,
}: ProposalBuilderDisabledActionsProps) {
  const headerLocks = lifecycleLocks
    ? HEADER_ACTION_ORDER.map((id) =>
        lifecycleLocks.find((lock) => lock.actionId === id)
      ).filter((lock): lock is ProposalBuilderLifecycleLock => Boolean(lock))
    : null;

  if (!headerLocks || headerLocks.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2" aria-label="Proposal actions (disabled)">
        {FALLBACK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled
            className={BUILDER_DISABLED_ACTION}
            title={`${action.label} — available in a later stage`}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Proposal lifecycle (staged, locked)">
      {headerLocks.map((lock) => {
        const isPreview = lock.actionId === "preview";
        const enabled =
          lock.state === "ready" || (isPreview && lock.state === "attention");
        const reason = lock.lockedReason ?? lock.unlockSummary;

        return (
          <button
            key={lock.actionId}
            type="button"
            disabled={!enabled}
            aria-disabled={!enabled}
            aria-label={
              enabled
                ? lock.state === "attention" && isPreview
                  ? `${lock.label} — contractor review only. ${reason}`
                  : `${lock.label} — open customer preview`
                : `${lock.label} — locked. ${reason}`
            }
            className={
              enabled
                ? isPreview
                  ? lock.state === "attention"
                    ? `${BUILDER_PREVIEW_ENABLED_ACTION} border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100/80`
                    : BUILDER_PREVIEW_ENABLED_ACTION
                  : BUILDER_DISABLED_ACTION
                : `${BUILDER_DISABLED_ACTION} ${
                    isPreview ? "border-blue-200 bg-blue-50/40 text-blue-400" : ""
                  }`
            }
            title={
              enabled
                ? lock.state === "attention" && isPreview
                  ? `Contractor review preview — ${reason}`
                  : "Open customer preview"
                : reason
            }
            onClick={() => {
              if (enabled) {
                onLifecycleAction?.(lock.actionId);
              }
            }}
          >
            {!enabled ? <Lock className="mr-1 h-3.5 w-3.5" aria-hidden /> : null}
            {lock.label}
          </button>
        );
      })}
    </div>
  );
}
