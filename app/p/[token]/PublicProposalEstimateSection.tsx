import type {
  ProposalPublicEstimateLineViewModel,
  ProposalPublicOptionCardViewModel,
} from "@/app/lib/proposalPublicEstimatePresentation";
import type { ProposalPublicProposalEstimateSectionViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import {
  PUBLIC_PROPOSAL_CARD,
  PUBLIC_PROPOSAL_CARD_INNER,
  PUBLIC_PROPOSAL_PAGE_TITLE,
  PUBLIC_PROPOSAL_SECTION_LABEL,
  publicProposalAccentBadgeClass,
  publicProposalAccentBorderClass,
} from "./publicProposalStyles";

type PublicProposalEstimateSectionProps = {
  estimate: ProposalPublicProposalEstimateSectionViewModel;
};

function EstimateLineRow({ line }: { line: ProposalPublicEstimateLineViewModel }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{line.name}</p>
        {line.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{line.description}</p>
        ) : null}
        {line.quantityLabel || line.unit ? (
          <p className="mt-1 text-xs text-slate-500">
            {[line.quantityLabel, line.unit].filter(Boolean).join(" ")}
          </p>
        ) : null}
      </div>
      {line.valueLabel ? (
        <p className="shrink-0 text-sm font-medium tabular-nums text-slate-900 sm:pl-4">
          {line.valueLabel}
        </p>
      ) : line.kind === "included" ? (
        <p className="shrink-0 text-xs font-medium uppercase tracking-wide text-emerald-700 sm:pl-4">
          Included
        </p>
      ) : null}
    </div>
  );
}

function OptionCard({ option }: { option: ProposalPublicOptionCardViewModel }) {
  const borderClass = publicProposalAccentBorderClass(option.accent);
  const badgeClass = publicProposalAccentBadgeClass(option.accent);

  return (
    <article
      className={`${PUBLIC_PROPOSAL_CARD} border-2 ${borderClass} ${option.isSelected ? "ring-2 ring-slate-300/80 ring-offset-1" : ""}`}
    >
      <div className={`${PUBLIC_PROPOSAL_CARD_INNER} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-950">{option.label}</h3>
            {option.customerLabel && option.customerLabel !== option.label ? (
              <p className="mt-0.5 text-sm text-slate-500">{option.customerLabel}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {option.isSelected ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>
                Selected
              </span>
            ) : null}
            {option.isRecommended && !option.isSelected ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Recommended
              </span>
            ) : null}
          </div>
        </div>

        {option.scopeSections.map((section) =>
          section.lines.length > 0 ? (
            <div key={`${option.optionKey}-${section.title}`} className="space-y-1">
              {section.showHeading ? (
                <p className={PUBLIC_PROPOSAL_SECTION_LABEL}>{section.title}</p>
              ) : null}
              <div>
                {section.lines.map((line) => (
                  <EstimateLineRow key={`${option.optionKey}-${line.name}`} line={line} />
                ))}
              </div>
            </div>
          ) : null
        )}

        {option.totals.showTotals ? (
          <div className="space-y-1.5 border-t border-slate-200 pt-4">
            {option.totals.subtotalLabel ? (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{option.totals.subtotalLabel}</span>
              </div>
            ) : null}
            {option.totals.discountLabel ? (
              <div className="flex justify-between text-sm text-emerald-700">
                <span>Discount</span>
                <span className="tabular-nums">{option.totals.discountLabel}</span>
              </div>
            ) : null}
            {option.totals.taxLabel ? (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax</span>
                <span className="tabular-nums">{option.totals.taxLabel}</span>
              </div>
            ) : null}
            {option.totals.totalLabel ? (
              <div className="flex justify-between pt-1 text-base font-semibold text-slate-950">
                <span>Total</span>
                <span className="tabular-nums">{option.totals.totalLabel}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function PublicProposalEstimateSection({ estimate }: PublicProposalEstimateSectionProps) {
  if (estimate.options.length === 0) {
    return null;
  }

  const gridClass =
    estimate.options.length > 1
      ? "grid gap-4 sm:grid-cols-2"
      : "grid gap-4";

  return (
    <section className="space-y-4" aria-label="Estimate">
      <h2 className={PUBLIC_PROPOSAL_PAGE_TITLE}>{estimate.sectionTitle}</h2>
      <div className={gridClass}>
        {estimate.options.map((option) => (
          <OptionCard key={option.optionKey} option={option} />
        ))}
      </div>
    </section>
  );
}
