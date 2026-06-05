import Link from "next/link";
import type { ProposalBuilderOptionCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import {
  BUILDER_DOCUMENT_TOTALS_BLOCK,
  BUILDER_LINE_LIST_FOOTER,
  BUILDER_PRICING_CONFIGURED_BANNER,
  BUILDER_PRICING_PREVIEW_BANNER,
  BUILDER_PRICING_PREVIEW_CONFIGURED_COPY,
  BUILDER_PRICING_PREVIEW_PLACEHOLDER_COPY,
  BUILDER_TOTALS_FOOTNOTE_CONFIGURED_COPY,
  BUILDER_TOTALS_FOOTNOTE_PLACEHOLDER_COPY,
  PRICING_SETTINGS_HREF,
  formatPriceCents,
} from "./proposalBuilderConstants";

type TotalsRowProps = {
  label: string;
  valueLabel: string;
  bold?: boolean;
};

function TotalsRow({ label, valueLabel, bold = false }: TotalsRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
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

type ProposalBuilderDocumentTotalsProps = {
  optionCustomerView: ProposalBuilderOptionCustomerView | null;
  /** 3I-3B3c: softens the preview banner once company pricing is configured. */
  pricingPolicyConfigured?: boolean;
};

export default function ProposalBuilderDocumentTotals({
  optionCustomerView,
  pricingPolicyConfigured = false,
}: ProposalBuilderDocumentTotalsProps) {
  const complete = optionCustomerView?.pricingComplete ?? false;
  const subtotal = optionCustomerView?.customerSubtotalCents ?? null;
  const discount = optionCustomerView?.discountCents ?? null;
  const tax = optionCustomerView?.salesTaxCents ?? null;
  const total = optionCustomerView?.customerTotalCents ?? null;

  const showDiscount = complete && discount != null && discount !== 0;
  const showTax = complete && tax != null && tax !== 0;

  const bannerClass = pricingPolicyConfigured
    ? BUILDER_PRICING_CONFIGURED_BANNER
    : BUILDER_PRICING_PREVIEW_BANNER;
  const bannerCopy = pricingPolicyConfigured
    ? BUILDER_PRICING_PREVIEW_CONFIGURED_COPY
    : BUILDER_PRICING_PREVIEW_PLACEHOLDER_COPY;
  const footnoteCopy = pricingPolicyConfigured
    ? BUILDER_TOTALS_FOOTNOTE_CONFIGURED_COPY
    : BUILDER_TOTALS_FOOTNOTE_PLACEHOLDER_COPY;

  return (
    <div className={BUILDER_DOCUMENT_TOTALS_BLOCK}>
      <div className={bannerClass}>
        <p>{bannerCopy}</p>
        {!pricingPolicyConfigured ? (
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

      {complete && subtotal != null && total != null ? (
        <div className="space-y-1.5 pt-2">
          <TotalsRow label="Subtotal" valueLabel={formatPriceCents(subtotal)} />
          {showDiscount && discount != null ? (
            <TotalsRow label="Discount" valueLabel={`−${formatPriceCents(Math.abs(discount))}`} />
          ) : null}
          {showTax && tax != null ? (
            <TotalsRow label="Sales tax" valueLabel={formatPriceCents(tax)} />
          ) : null}
          <div className="border-t border-slate-200/60 pt-1.5">
            <TotalsRow label="Total" valueLabel={formatPriceCents(total)} bold />
          </div>
        </div>
      ) : (
        <p className="pt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">Pricing incomplete</span> — one or more
          lines are missing a catalog item or unresolved quantity. Resolve all lines to see
          estimated totals.
        </p>
      )}

      <p className={`${BUILDER_LINE_LIST_FOOTER} pt-2`}>{footnoteCopy}</p>
    </div>
  );
}
