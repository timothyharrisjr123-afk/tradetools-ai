"use client";

import type {
  CustomerPreviewEstimateTotalsPresentation,
  CustomerPreviewPackageHero,
} from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  PACKET_PACKAGE_DESCRIPTION,
  PACKET_PACKAGE_HIGHLIGHTS,
  PACKET_PACKAGE_KICKER,
  PACKET_PACKAGE_NAME,
  PACKET_SECTION_PAD,
  PACKET_TOTAL_LABEL,
  PACKET_TOTAL_VALUE,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPackageStripProps = {
  packageHero: CustomerPreviewPackageHero;
  totals: CustomerPreviewEstimateTotalsPresentation;
};

/**
 * Block 5C — proposed package strip: a confident sales band, not a card.
 *
 * No package-picker or edit affordance — this is the customer's proposed
 * option, presented once, plainly.
 */
export default function ProposalCustomerPreviewPackageStrip({
  packageHero,
  totals,
}: ProposalCustomerPreviewPackageStripProps) {
  if (!packageHero.label) {
    return null;
  }

  const highlights = packageHero.bullets.length > 0 ? packageHero.bullets.join("  ·  ") : null;
  const showTotal = totals.show && totals.totalLabel != null;

  return (
    <div className={`${PACKET_SECTION_PAD} pb-8 pt-8`} data-preview-package-strip>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <p className={PACKET_PACKAGE_KICKER}>Proposed package</p>
          <p className={`mt-1.5 ${PACKET_PACKAGE_NAME}`}>{packageHero.label}</p>
          {packageHero.description ? (
            <p className={`mt-1.5 ${PACKET_PACKAGE_DESCRIPTION}`}>{packageHero.description}</p>
          ) : null}
          {highlights ? <p className={`mt-2 ${PACKET_PACKAGE_HIGHLIGHTS}`}>{highlights}</p> : null}
        </div>
        {showTotal ? (
          <div className="shrink-0 text-right">
            <p className={PACKET_TOTAL_LABEL}>Total investment</p>
            <p className={`mt-0.5 ${PACKET_TOTAL_VALUE}`}>{totals.totalLabel}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
