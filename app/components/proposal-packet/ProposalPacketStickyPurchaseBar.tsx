"use client";

import { useEffect, useRef, useState } from "react";
import { isCustomerPaymentPayableState } from "@/app/lib/jobPaymentCustomerPresenter";
import type { PublicPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import {
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_SHORT_CTA,
  proposalCustomerAmountLabel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_STICKY_BAR,
} from "./proposalPacketStyles";
import type { ProposalPurchaseAction } from "./useProposalPurchaseAction";

type ProposalPacketStickyPurchaseBarProps = {
  /** Element to watch. The bar appears only once the decision scrolls away. */
  watchRef: React.RefObject<HTMLElement | null>;
  payment: PublicPaymentViewModel | null;
  dueLabel: string | null;
  action: ProposalPurchaseAction;
};

export default function ProposalPacketStickyPurchaseBar({
  watchRef,
  payment,
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
  const amount = proposalCustomerAmountLabel(dueLabel ?? payment?.amountLabel);
  const showDue =
    action.kind === "pay" && isCustomerPaymentPayableState(payment?.state) && amount;

  return (
    <div className={PROPOSAL_PACKET_STICKY_BAR} data-proposal-sticky-purchase>
      {showDue ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-[#64748b]">
            {payment?.kindLabel ?? payment?.heading}
          </p>
          <p className="truncate text-[17px] font-semibold tabular-nums tracking-[-0.03em] text-[#0b1f33]">
            {amount}
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
        aria-busy={action.busy || undefined}
        aria-label={label ?? undefined}
        data-proposal-sticky-action={action.kind}
      >
        {label}
      </button>
    </div>
  );
}
