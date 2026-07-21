"use client";

import { Check, Sparkles } from "lucide-react";
import type {
  CustomerPreviewEstimateTotalsPresentation,
  CustomerPreviewPackageHero,
} from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  PACKET_PACKAGE_BADGE,
  PACKET_PACKAGE_CHECK,
  PACKET_PACKAGE_DESCRIPTION,
  PACKET_PACKAGE_INCLUDE_ITEM,
  PACKET_PACKAGE_INCLUDES_LABEL,
  PACKET_PACKAGE_KICKER,
  PACKET_PACKAGE_NAME,
  PACKET_PACKAGE_PANEL,
  PACKET_PACKAGE_SURFACE,
  PACKET_TOTAL_LABEL,
  PACKET_TOTAL_VALUE,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPackageStripProps = {
  packageHero: CustomerPreviewPackageHero;
  totals: CustomerPreviewEstimateTotalsPresentation;
  accentColor?: string;
};

/**
 * Selected package recommendation — premium, intentional, not a selector.
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
      <div className={PACKET_PACKAGE_SURFACE}>
        <span
          className="absolute inset-y-3 left-0 w-[3px] rounded-r-full"
          style={{ backgroundColor: accentColor ?? "#2563eb" }}
          aria-hidden
        />
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(13rem,0.8fr)] sm:items-start sm:gap-8">
          <div className="min-w-0 pl-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className={PACKET_PACKAGE_KICKER}>Selected package</p>
              <span className={PACKET_PACKAGE_BADGE} data-preview-package-badge>
                <Sparkles className="h-3 w-3" aria-hidden />
                Recommended
              </span>
            </div>
            <p className={PACKET_PACKAGE_NAME}>{packageDisplayName}</p>
            {packageHero.description ? (
              <p className={PACKET_PACKAGE_DESCRIPTION}>{packageHero.description}</p>
            ) : null}
            {showTotal ? (
              <div className="mt-3.5">
                <p className={PACKET_TOTAL_LABEL}>Total investment</p>
                <p className={PACKET_TOTAL_VALUE}>{totals.totalLabel}</p>
              </div>
            ) : null}
          </div>

          {packageHero.bullets.length > 0 ? (
            <div className="border-t border-slate-200/80 pt-4 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0.5">
              <p className={PACKET_PACKAGE_INCLUDES_LABEL}>Package highlights</p>
              <ul className="mt-2.5 space-y-2">
                {packageHero.bullets.map((bullet) => (
                  <li key={bullet} className={PACKET_PACKAGE_INCLUDE_ITEM}>
                    <span className={PACKET_PACKAGE_CHECK} aria-hidden>
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
