import Link from "next/link";
import { CircleDashed, Receipt } from "lucide-react";
import type { WorkbenchTotalsZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  BUILDER_PRICING_CONFIGURED_BANNER,
  BUILDER_PRICING_PREVIEW_BANNER,
  BUILDER_TOTALS_FOOTNOTE_CONFIGURED_COPY,
  BUILDER_TOTALS_FOOTNOTE_PLACEHOLDER_COPY,
  PRICING_SETTINGS_HREF,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
  WORKBENCH_TOTALS_AMOUNT_STACK,
  WORKBENCH_TOTALS_BODY,
  WORKBENCH_TOTALS_FOOTNOTE,
  WORKBENCH_TOTALS_HEADER,
  WORKBENCH_TOTALS_INCOMPLETE_PANEL,
  WORKBENCH_TOTALS_ZONE,
} from "./proposalBuilderConstants";

type TotalsRowProps = {
  label: string;
  valueLabel: string;
  bold?: boolean;
};

function TotalsRow({ label, valueLabel, bold = false }: TotalsRowProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className={`text-sm ${bold ? "font-semibold text-slate-900" : "text-slate-600"}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "text-base font-semibold text-slate-900" : "text-sm text-slate-700"}`}
      >
        {valueLabel}
      </span>
    </div>
  );
}

type ProposalBuilderWorkbenchTotalsZoneProps = {
  zone: WorkbenchTotalsZone;
};

export default function ProposalBuilderWorkbenchTotalsZone({
  zone,
}: ProposalBuilderWorkbenchTotalsZoneProps) {
  const bannerClass = zone.policyBanner.configured
    ? BUILDER_PRICING_CONFIGURED_BANNER
    : BUILDER_PRICING_PREVIEW_BANNER;
  const footnoteCopy = zone.pricingPolicyConfigured
    ? BUILDER_TOTALS_FOOTNOTE_CONFIGURED_COPY
    : BUILDER_TOTALS_FOOTNOTE_PLACEHOLDER_COPY;

  return (
    <section className={WORKBENCH_TOTALS_ZONE} aria-labelledby="workbench-totals-heading">
      <header className={WORKBENCH_TOTALS_HEADER}>
        <div className="flex items-start gap-2.5">
          {zone.showAmounts ? (
            <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
          ) : (
            <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          )}
          <div>
            <p className={WORKBENCH_MODULE_KICKER} id="workbench-totals-heading">
              Totals
            </p>
            <p className={WORKBENCH_MODULE_TITLE}>
              {zone.showAmounts ? "Totals ready" : "Totals pending review"}
            </p>
          </div>
        </div>
      </header>

      <div className={WORKBENCH_TOTALS_BODY}>
        {zone.policyBanner.show ? (
          <div className={bannerClass}>
            <p>{zone.policyBanner.copy}</p>
            {!zone.pricingPolicyConfigured ? (
              <p className="mt-1.5">
                <Link
                  href={PRICING_SETTINGS_HREF}
                  className="font-medium underline underline-offset-2 hover:opacity-80"
                >
                  Set up company pricing
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {zone.showAmounts && zone.subtotalLabel != null && zone.totalLabel != null ? (
          <div className={WORKBENCH_TOTALS_AMOUNT_STACK}>
            <TotalsRow label="Subtotal" valueLabel={zone.subtotalLabel} />
            {zone.discountLabel ? (
              <TotalsRow label="Discount" valueLabel={zone.discountLabel} />
            ) : null}
            {zone.taxLabel ? <TotalsRow label="Sales tax" valueLabel={zone.taxLabel} /> : null}
            <div className="border-t border-slate-200/60 pt-1.5">
              <TotalsRow label="Total" valueLabel={zone.totalLabel} bold />
            </div>
          </div>
        ) : zone.incompleteCopy ? (
          <div className={`mt-3 ${WORKBENCH_TOTALS_INCOMPLETE_PANEL}`}>
            <p>{zone.incompleteCopy}</p>
          </div>
        ) : null}

        <p className={WORKBENCH_TOTALS_FOOTNOTE}>{footnoteCopy}</p>
      </div>
    </section>
  );
}
