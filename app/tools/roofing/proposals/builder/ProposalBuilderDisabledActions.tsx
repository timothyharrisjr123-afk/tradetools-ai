import { Lock } from "lucide-react";
import type { ProposalBuilderLifecycleLock } from "@/app/lib/proposalBuilderGuidance";
import { BUILDER_DISABLED_ACTION } from "./proposalBuilderConstants";

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
};

export default function ProposalBuilderDisabledActions({
  lifecycleLocks = null,
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
        // Preview is the first locked-but-reachable stage — give it a slightly
        // stronger affordance than the deeper-future actions. All remain disabled.
        const reachable = lock.actionId === "preview";
        const reason = lock.lockedReason ?? lock.unlockSummary;
        return (
          <button
            key={lock.actionId}
            type="button"
            disabled
            aria-disabled
            aria-label={`${lock.label} — locked. ${reason}`}
            className={`${BUILDER_DISABLED_ACTION} ${
              reachable ? "border-blue-200 bg-blue-50/40 text-blue-400" : ""
            }`}
            title={reason}
          >
            <Lock className="mr-1 h-3.5 w-3.5" aria-hidden />
            {lock.label}
          </button>
        );
      })}
    </div>
  );
}
