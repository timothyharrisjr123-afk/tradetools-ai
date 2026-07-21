"use client";

import { Check } from "lucide-react";
import type {
  CustomerPreviewEstimateTotalsPresentation,
  CustomerPreviewPackageHero,
} from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  PACKET_PACKAGE_CHECK,
  PACKET_PACKAGE_DESCRIPTION,
  PACKET_PACKAGE_INCLUDE_ITEM,
  PACKET_PACKAGE_INCLUDES_LABEL,
  PACKET_PACKAGE_KICKER,
  PACKET_PACKAGE_NAME,
  PACKET_PACKAGE_PANEL,
  PACKET_TOTAL_LABEL,
  PACKET_TOTAL_VALUE,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPackageStripProps = {
  packageHero: CustomerPreviewPackageHero;
  totals: CustomerPreviewEstimateTotalsPresentation;
  accentColor?: string;
};

/**
 * Featured package recommendation — explains the offer, not a selector.
 * Checkmarked includes + optional total investment when pricing is complete.
 */
export default function ProposalCustomerPreviewPackageStrip({
  packageHero,
  totals,
  accentColor,
}: ProposalCustomerPreviewPackageStripProps) {
  if (!packageHero.label) {
    return null;
  }

  const showTotal = totals.show && totals.totalLabel != null;
  const packageDisplayName = /\bpackage\b/i.test(packageHero.label)
    ? packageHero.label
    : `${packageHero.label} package`;

  return (
    <div
      className={PACKET_PACKAGE_PANEL}
      data-preview-package-strip
      data-preview-package-recommendation
    >
      {accentColor ? (
        <div
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
      ) : null}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
        <div className="min-w-0 flex-1">
          <p className={PACKET_PACKAGE_KICKER}>Selected for your home</p>
          <p className={PACKET_PACKAGE_NAME}>{packageDisplayName}</p>
          {packageHero.description ? (
            <p className={PACKET_PACKAGE_DESCRIPTION}>{packageHero.description}</p>
          ) : null}

          {packageHero.bullets.length > 0 ? (
            <div className="mt-1">
              <p className={PACKET_PACKAGE_INCLUDES_LABEL}>Includes</p>
              <ul className="mt-2.5 space-y-2">
                {packageHero.bullets.map((bullet) => (
                  <li key={bullet} className={PACKET_PACKAGE_INCLUDE_ITEM}>
                    <span className={PACKET_PACKAGE_CHECK} aria-hidden>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {showTotal ? (
          <div className="shrink-0 rounded-xl border border-slate-200/80 bg-white px-5 py-4 text-left shadow-sm sm:min-w-[11rem] sm:text-right">
            <p className={PACKET_TOTAL_LABEL}>Total investment</p>
            <p className={PACKET_TOTAL_VALUE}>{totals.totalLabel}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
