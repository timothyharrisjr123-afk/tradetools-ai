import {
  PAYMENT_TERMS_SECTION_LABEL,
  type ProposalPaymentTerms,
  formatPaymentTermsCustomerCopy,
} from "@/app/lib/proposalPaymentTerms";

type ProposalPaymentTermsBlockProps = {
  terms: ProposalPaymentTerms;
  selectedTotalCents?: number | null;
};

export default function ProposalPaymentTermsBlock({
  terms,
  selectedTotalCents = null,
}: ProposalPaymentTermsBlockProps) {
  const copy = formatPaymentTermsCustomerCopy(terms, selectedTotalCents);
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white px-5 py-4"
      aria-label={PAYMENT_TERMS_SECTION_LABEL}
      data-proposal-payment-terms
      data-proposal-payment-terms-mode={terms.depositMode}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {PAYMENT_TERMS_SECTION_LABEL}
      </p>
      <p className="mt-1.5 text-base font-medium text-slate-900">{copy.depositLine}</p>
      <p className="mt-0.5 text-sm text-slate-600">{copy.balanceLine}</p>
    </section>
  );
}
