import type { ProposalBuilderOptionCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import {
  BUILDER_DOCUMENT_TOTALS_BLOCK,
  BUILDER_LINE_LIST_FOOTER,
  BUILDER_PRICING_PREVIEW_BANNER,
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
};

export default function ProposalBuilderDocumentTotals({
  optionCustomerView,
}: ProposalBuilderDocumentTotalsProps) {
  const complete = optionCustomerView?.pricingComplete ?? false;
  const subtotal = optionCustomerView?.customerSubtotalCents ?? null;
  const discount = optionCustomerView?.discountCents ?? null;
  const tax = optionCustomerView?.salesTaxCents ?? null;
  const total = optionCustomerView?.customerTotalCents ?? null;

  const showDiscount = complete && discount != null && discount !== 0;
  const showTax = complete && tax != null && tax !== 0;

  return (
    <div className={BUILDER_DOCUMENT_TOTALS_BLOCK}>
      {/* Persistent preview banner — always visible when this block renders. */}
      <div className={BUILDER_PRICING_PREVIEW_BANNER}>
        <span className="font-semibold">Preview pricing</span>
        {" — "}
        uses a placeholder 50% margin, not your company&apos;s configured pricing. Not a customer
        quote.
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

      <p className={`${BUILDER_LINE_LIST_FOOTER} pt-2`}>
        Final pricing requires your company&apos;s saved pricing configuration. Preview totals are
        estimates only.
      </p>
    </div>
  );
}
