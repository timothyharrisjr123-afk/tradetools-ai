import Link from "next/link";
import type { WorkbenchTotalsZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  BUILDER_PRICING_PREVIEW_BANNER,
  BUILDER_TOTALS_FOOTNOTE_CONFIGURED_COPY,
  BUILDER_TOTALS_FOOTNOTE_PLACEHOLDER_COPY,
  PRICING_SETTINGS_HREF,
  WORKBENCH_TOTALS_AMOUNT_STACK,
  WORKBENCH_TOTALS_BODY,
  WORKBENCH_TOTALS_FOOTNOTE,
  WORKBENCH_TOTALS_HEADER,
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
  const footnoteCopy = zone.pricingPolicyConfigured
    ? BUILDER_TOTALS_FOOTNOTE_CONFIGURED_COPY
    : BUILDER_TOTALS_FOOTNOTE_PLACEHOLDER_COPY;

  return (
    <section className={WORKBENCH_TOTALS_ZONE} aria-labelledby="workbench-totals-heading">
      <header className={WORKBENCH_TOTALS_HEADER}>
        <p
          className="text-sm font-semibold text-slate-900"
          id="workbench-totals-heading"
        >
          Totals
        </p>
      </header>

      <div className={WORKBENCH_TOTALS_BODY}>
        {zone.policyBanner.show && !zone.pricingPolicyConfigured ? (
          <div className={BUILDER_PRICING_PREVIEW_BANNER}>
            <p>{zone.policyBanner.copy}</p>
            <p className="mt-1.5">
              <Link
                href={PRICING_SETTINGS_HREF}
                className="font-medium underline underline-offset-2 hover:opacity-80"
              >
                Set up company pricing
              </Link>
            </p>
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
          <p className="text-[13px] text-slate-600">{zone.incompleteCopy}</p>
        ) : null}

        {zone.showAmounts ? (
          <p className={WORKBENCH_TOTALS_FOOTNOTE}>{footnoteCopy}</p>
        ) : null}
      </div>
    </section>
  );
}
