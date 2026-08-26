"use client";

import { useEffect, useRef, useState } from "react";
import {
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_SHORT_CTA,
  PROPOSAL_CUSTOMER_PACKET_DUE_TODAY_LABEL,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_STICKY_BAR,
} from "./proposalPacketStyles";
import type { ProposalPurchaseAction } from "./useProposalPurchaseAction";

type ProposalPacketStickyPurchaseBarProps = {
  /** Element to watch. The bar appears only once the decision scrolls away. */
  watchRef: React.RefObject<HTMLElement | null>;
  dueLabel: string | null;
  action: ProposalPurchaseAction;
};

/**
 * Small-screen presentation of the SAME primary action. It renders the action
 * from useProposalPurchaseAction rather than owning a second handler, so there
 * is exactly one canonical commitment path.
 */
export default function ProposalPacketStickyPurchaseBar({
  watchRef,
  dueLabel,
  action,
}: ProposalPacketStickyPurchaseBarProps) {
  const [visible, setVisible] = useState(false);
  const observed = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const target = watchRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    observed.current = target;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // Show only after the composition has scrolled fully out of view above.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchRef]);

  if (action.kind === "none" || !visible) return null;

  const label =
    action.kind === "confirm" && !action.busy
      ? PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_SHORT_CTA
      : action.label;

  return (
    <div className={PROPOSAL_PACKET_STICKY_BAR} data-proposal-sticky-purchase>
      {action.kind === "pay" && dueLabel ? (
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
            {PROPOSAL_CUSTOMER_PACKET_DUE_TODAY_LABEL}
          </p>
          <p className="truncate text-[17px] font-semibold tabular-nums tracking-[-0.03em] text-[#0b1f33]">
            {dueLabel}
          </p>
        </div>
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      <button
        type="button"
        className={`${PROPOSAL_PACKET_CTA_PRIMARY} shrink-0 px-4`}
        onClick={action.submit}
        disabled={action.busy}
        data-proposal-sticky-action={action.kind}
      >
        {label}
      </button>
    </div>
  );
}
