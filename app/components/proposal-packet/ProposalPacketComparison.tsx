import type {
  ProposalCustomerPacketComparisonViewModel,
  ProposalCustomerPacketContactViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING,
  PROPOSAL_CUSTOMER_PACKET_COMPARE_INTRO,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE,
  proposalCustomerPacketAskAboutPackageCta,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { buildPackageInterestHref } from "@/app/lib/proposalCustomerPacketInterestAction";
import { IconCheck } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_CTA_QUIET,
  PROPOSAL_PACKET_CURRENT_BADGE,
  PROPOSAL_PACKET_OPTION_CARD,
  PROPOSAL_PACKET_OPTION_CARD_CURRENT,
  PROPOSAL_PACKET_SECONDARY_PRICE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
  resolveProposalPacketCompareRowClass,
} from "./proposalPacketStyles";

type ProposalPacketComparisonProps = {
  comparison: ProposalCustomerPacketComparisonViewModel;
  contact?: ProposalCustomerPacketContactViewModel | null;
};

function cellTextClass(
  availability: "included" | "available" | "not_included",
  differs: boolean,
  isCurrent: boolean
): string {
  if (availability === "not_included") {
    return "text-[#94a3b8]";
  }
  if (availability === "available") {
    return "text-[#64748b]";
  }
  if (isCurrent || differs) {
    return "font-medium text-[#0b1f33]";
  }
  return "text-[#334155]";
}

export default function ProposalPacketComparison({
  comparison,
  contact = null,
}: ProposalPacketComparisonProps) {
  if (comparison.options.length < 2) return null;

  const compareRowClass = resolveProposalPacketCompareRowClass(comparison.options.length);
  const dimensions = comparison.dimensions;
  const hasAlignedDimensions =
    dimensions.length > 0 && comparison.options.every((option) => option.cells.length === dimensions.length);
  const baselineCells = comparison.options[0]?.cells ?? [];

  return (
    <div>
      <div className="mb-3.5">
        <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>{PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING}</h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>{PROPOSAL_CUSTOMER_PACKET_COMPARE_INTRO}</p>
      </div>

      {hasAlignedDimensions ? (
        <div className="hidden lg:block" data-proposal-compare-matrix>
          <div
            className="overflow-hidden rounded-[16px] border border-[#e2e8f0] bg-white shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_24px_rgba(11,31,51,0.04)]"
            style={{
              display: "grid",
              gridTemplateColumns: `minmax(9rem,0.85fr) repeat(${comparison.options.length}, minmax(0,1fr))`,
            }}
          >
            <div className="border-b border-[#eef2f6] bg-[#f8fafc] px-4 py-3" />
            {comparison.options.map((option) => (
              <div
                key={`head-${option.optionKey}`}
                className={`border-b border-l border-[#eef2f6] px-4 py-3 ${
                  option.isCurrent ? "bg-[#f8fbff]" : "bg-[#f8fafc]"
                }`}
              >
                <div className="flex min-h-[1.35rem] items-center justify-between gap-2">
                  <p className="text-[0.98rem] font-semibold tracking-tight text-[#0b1f33]">{option.label}</p>
                  {option.isCurrent ? (
                    <span className={PROPOSAL_PACKET_CURRENT_BADGE}>
                      {PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}

            {dimensions.map((dimension, dimensionIndex) => (
              <div key={`dim-${dimension.label}`} className="contents">
                <div className="border-b border-[#eef2f6] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                  {dimension.label}
                </div>
                {comparison.options.map((option) => {
                  const cell = option.cells[dimensionIndex];
                  const differs = (cell?.valueLabel ?? "") !== (baselineCells[dimensionIndex]?.valueLabel ?? "");
                  return (
                    <div
                      key={`${option.optionKey}-${dimension.label}`}
                      className={`border-b border-l border-[#eef2f6] px-4 py-2.5 text-[13px] leading-snug ${
                        option.isCurrent ? "bg-[#f8fbff]" : ""
                      } ${cellTextClass(cell?.availability ?? "not_included", differs, option.isCurrent)}`}
                      data-proposal-compare-availability={cell?.availability}
                    >
                      {cell?.valueLabel ?? "—"}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
              Your investment
            </div>
            {comparison.options.map((option) => (
              <div
                key={`price-${option.optionKey}`}
                className={`border-l border-[#eef2f6] px-4 py-3 ${option.isCurrent ? "bg-[#f8fbff]" : ""}`}
              >
                {option.totalInvestmentLabel ? (
                  <p
                    className={`${PROPOSAL_PACKET_SECONDARY_PRICE} text-[1.12rem] ${
                      option.isCurrent ? "text-[#2563eb]" : ""
                    }`}
                  >
                    {option.totalInvestmentLabel}
                  </p>
                ) : null}
                {!option.isCurrent ? (
                  <a
                    href={buildPackageInterestHref(contact, option.label, "ask-about")}
                    className={`${PROPOSAL_PACKET_CTA_QUIET} mt-2`}
                    data-proposal-cta="ask-about-package"
                  >
                    {proposalCustomerPacketAskAboutPackageCta(option.label)}
                  </a>
                ) : (
                  <p className="mt-2 text-[12px] font-medium text-[#2563eb]">Selected for this proposal</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={`${compareRowClass} ${hasAlignedDimensions ? "lg:hidden" : ""}`}
        role="list"
        aria-readonly="true"
        data-proposal-compare-count={comparison.options.length}
      >
        {comparison.options.map((option) => (
          <div
            key={option.optionKey}
            className={option.isCurrent ? PROPOSAL_PACKET_OPTION_CARD_CURRENT : PROPOSAL_PACKET_OPTION_CARD}
            role="listitem"
            aria-disabled="true"
            aria-current={option.isCurrent ? "true" : undefined}
          >
            <div className="mb-1.5 flex min-h-[1.35rem] items-center justify-between gap-2">
              <p className="text-[1rem] font-semibold tracking-tight text-[#0b1f33]">
                {option.label}
              </p>
              {option.isCurrent ? (
                <span className={PROPOSAL_PACKET_CURRENT_BADGE}>
                  {PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE}
                </span>
              ) : null}
            </div>

            {option.description ? (
              <p className="text-[13px] leading-snug text-[#64748b]">
                {option.description}
              </p>
            ) : null}

            {hasAlignedDimensions ? (
              <dl className="mt-3 flex-1 space-y-2">
                {dimensions.map((dimension, dimensionIndex) => {
                  const cell = option.cells[dimensionIndex];
                  const differs = (cell?.valueLabel ?? "") !== (baselineCells[dimensionIndex]?.valueLabel ?? "");
                  return (
                    <div key={`${option.optionKey}-m-${dimension.label}`}>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                        {dimension.label}
                      </dt>
                      <dd
                        className={`mt-0.5 text-[13px] leading-snug ${cellTextClass(
                          cell?.availability ?? "not_included",
                          differs,
                          option.isCurrent
                        )}`}
                        data-proposal-compare-availability={cell?.availability}
                      >
                        {cell?.valueLabel ?? "—"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : option.bullets.length > 0 ? (
              <ul className="mt-3 flex-1 space-y-1.5">
                {option.bullets.slice(0, 4).map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-[13px] text-[#334155]">
                    <IconCheck
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${option.isCurrent ? "text-[#2563eb]" : "text-[#64748b]"}`}
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1" aria-hidden />
            )}

            {option.totalInvestmentLabel ? (
              <p
                className={`${PROPOSAL_PACKET_SECONDARY_PRICE} mt-4 text-[1.15rem] ${
                  option.isCurrent ? "text-[#2563eb]" : ""
                }`}
              >
                {option.totalInvestmentLabel}
              </p>
            ) : null}

            {!option.isCurrent ? (
              <a
                href={buildPackageInterestHref(contact, option.label, "ask-about")}
                className={PROPOSAL_PACKET_CTA_QUIET}
                data-proposal-cta="ask-about-package"
              >
                {proposalCustomerPacketAskAboutPackageCta(option.label)}
              </a>
            ) : (
              <span className="mt-3 block min-h-[44px]" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
