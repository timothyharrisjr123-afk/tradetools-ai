"use client";

import type { ProposalCustomerPacketComparisonViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_CHOOSE_HEADING,
  PROPOSAL_CUSTOMER_PACKET_CHOOSE_INTRO,
  PROPOSAL_CUSTOMER_PACKET_CHOSEN_BADGE,
  PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING,
  PROPOSAL_CUSTOMER_PACKET_COMPARE_INTRO,
  proposalCustomerPacketChooseCta,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { IconCheck } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_CHOICE_BADGE,
  PROPOSAL_PACKET_CHOICE_BUTTON,
  PROPOSAL_PACKET_CHOICE_BUTTON_CHOSEN,
  PROPOSAL_PACKET_OPTION_CARD,
  PROPOSAL_PACKET_OPTION_CARD_CHOSEN,
  PROPOSAL_PACKET_SECONDARY_PRICE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
  resolveProposalPacketCompareRowClass,
} from "./proposalPacketStyles";

type ProposalPacketComparisonProps = {
  comparison: ProposalCustomerPacketComparisonViewModel;
  /**
   * Option the customer has chosen. Falls back to the contractor's frozen
   * selection so contractor Preview renders the same document without choice.
   */
  chosenOptionKey?: string | null;
  /** Present only on the live customer page. Absent renders a read-only document. */
  onChoose?: (optionKey: string) => void;
  /** Choice is contractual once accepted, so the picker locks. */
  locked?: boolean;
  /** True while a package choice is being persisted. */
  pending?: boolean;
};

function cellTextClass(
  availability: "included" | "available" | "not_included",
  differs: boolean,
  isChosen: boolean
): string {
  if (availability === "not_included") {
    return "text-[#94a3b8]";
  }
  if (availability === "available") {
    return "text-[#64748b]";
  }
  if (isChosen || differs) {
    return "font-medium text-[#0b1f33]";
  }
  return "text-[#334155]";
}

export default function ProposalPacketComparison({
  comparison,
  chosenOptionKey = null,
  onChoose,
  locked = false,
  pending = false,
}: ProposalPacketComparisonProps) {
  if (comparison.options.length < 2) return null;

  const compareRowClass = resolveProposalPacketCompareRowClass(comparison.options.length);
  const dimensions = comparison.dimensions;
  const hasAlignedDimensions =
    dimensions.length > 0 && comparison.options.every((option) => option.cells.length === dimensions.length);
  const baselineCells = comparison.options[0]?.cells ?? [];
  const choosable = typeof onChoose === "function" && !locked;

  // On a card the customer only needs the differences. Dimensions every package
  // shares are repetition, so they stay in the desktop matrix.
  const differingDimensionIndexes = dimensions
    .map((_, index) => index)
    .filter((index) => {
      const baseline = baselineCells[index]?.valueLabel ?? "";
      return comparison.options.some(
        (option) => (option.cells[index]?.valueLabel ?? "") !== baseline
      );
    });
  const cardDimensionIndexes = (
    differingDimensionIndexes.length > 0
      ? differingDimensionIndexes
      : dimensions.map((_, index) => index)
  ).slice(0, 4);

  const isChosen = (optionKey: string, fallbackIsCurrent: boolean): boolean =>
    chosenOptionKey != null ? optionKey === chosenOptionKey : fallbackIsCurrent;

  return (
    <div aria-busy={pending || undefined}>
      <div className="mb-3.5">
        <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>
          {choosable
            ? PROPOSAL_CUSTOMER_PACKET_CHOOSE_HEADING
            : PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING}
        </h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>
          {choosable
            ? PROPOSAL_CUSTOMER_PACKET_CHOOSE_INTRO
            : PROPOSAL_CUSTOMER_PACKET_COMPARE_INTRO}
        </p>
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
            <div className="px-5 pb-4 pt-5" />
            {comparison.options.map((option) => {
              const chosen = isChosen(option.optionKey, option.isCurrent);
              return (
                <div
                  key={`head-${option.optionKey}`}
                  className={`px-5 pb-4 pt-5 ${chosen ? "bg-[#f7fbff]" : ""}`}
                >
                  <div className="flex min-h-[1.5rem] items-center gap-2">
                    <p className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#0b1f33]">
                      {option.label}
                    </p>
                    {chosen ? (
                      <span className={PROPOSAL_PACKET_CHOICE_BADGE}>
                        {PROPOSAL_CUSTOMER_PACKET_CHOSEN_BADGE}
                      </span>
                    ) : null}
                  </div>
                  {option.totalInvestmentLabel ? (
                    <p
                      className={`${PROPOSAL_PACKET_SECONDARY_PRICE} mt-1 text-[1.45rem] ${
                        chosen ? "text-[#2563eb]" : ""
                      }`}
                    >
                      {option.totalInvestmentLabel}
                    </p>
                  ) : null}
                </div>
              );
            })}

            {dimensions.map((dimension, dimensionIndex) => (
              <div key={`dim-${dimension.label}`} className="contents">
                <div className="border-t border-[#f1f5f9] px-5 py-2.5 text-[12.5px] text-[#64748b]">
                  {dimension.label}
                </div>
                {comparison.options.map((option) => {
                  const cell = option.cells[dimensionIndex];
                  const chosen = isChosen(option.optionKey, option.isCurrent);
                  const differs = (cell?.valueLabel ?? "") !== (baselineCells[dimensionIndex]?.valueLabel ?? "");
                  return (
                    <div
                      key={`${option.optionKey}-${dimension.label}`}
                      className={`border-t border-[#f1f5f9] px-5 py-2.5 text-[13px] leading-snug ${
                        chosen ? "bg-[#f7fbff]" : ""
                      } ${cellTextClass(cell?.availability ?? "not_included", differs, chosen)}`}
                      data-proposal-compare-availability={cell?.availability}
                    >
                      {cell?.valueLabel ?? "—"}
                    </div>
                  );
                })}
              </div>
            ))}

            {choosable ? (
              <>
                <div className="px-5 pb-5 pt-4" />
                {comparison.options.map((option) => {
                  const chosen = isChosen(option.optionKey, option.isCurrent);
                  return (
                    <div
                      key={`choose-${option.optionKey}`}
                      className={`px-5 pb-5 pt-4 ${chosen ? "bg-[#f7fbff]" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => onChoose!(option.optionKey)}
                        aria-pressed={chosen}
                        disabled={pending}
                        className={chosen ? PROPOSAL_PACKET_CHOICE_BUTTON_CHOSEN : PROPOSAL_PACKET_CHOICE_BUTTON}
                        data-proposal-choose-option={option.optionKey}
                      >
                        {chosen ? (
                          <>
                            <IconCheck className="h-4 w-4 shrink-0" />
                            <span>{PROPOSAL_CUSTOMER_PACKET_CHOSEN_BADGE}</span>
                          </>
                        ) : (
                          <span>{proposalCustomerPacketChooseCta(option.label)}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={`${compareRowClass} ${hasAlignedDimensions ? "lg:hidden" : ""}`}
        role="list"
        data-proposal-compare-count={comparison.options.length}
      >
        {comparison.options.map((option) => {
          const chosen = isChosen(option.optionKey, option.isCurrent);
          return (
            <div
              key={option.optionKey}
              className={chosen ? PROPOSAL_PACKET_OPTION_CARD_CHOSEN : PROPOSAL_PACKET_OPTION_CARD}
              role="listitem"
              aria-current={chosen ? "true" : undefined}
            >
              <div className="mb-1.5 flex min-h-[1.35rem] items-center justify-between gap-2">
                <p className="text-[1rem] font-semibold tracking-tight text-[#0b1f33]">
                  {option.label}
                </p>
                {chosen ? (
                  <span className={PROPOSAL_PACKET_CHOICE_BADGE}>
                    {PROPOSAL_CUSTOMER_PACKET_CHOSEN_BADGE}
                  </span>
                ) : null}
              </div>

              {option.description ? (
                <p className="text-[13px] leading-snug text-[#64748b]">
                  {option.description}
                </p>
              ) : null}

              {hasAlignedDimensions ? (
                <dl className="mt-3 flex-1 space-y-1.5">
                  {cardDimensionIndexes.map((dimensionIndex) => {
                    const dimension = dimensions[dimensionIndex];
                    const cell = option.cells[dimensionIndex];
                    const differs = (cell?.valueLabel ?? "") !== (baselineCells[dimensionIndex]?.valueLabel ?? "");
                    return (
                      <div
                        key={`${option.optionKey}-m-${dimension.label}`}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <dt className="text-[12.5px] text-[#64748b]">{dimension.label}</dt>
                        <dd
                          className={`text-right text-[13px] leading-snug ${cellTextClass(
                            cell?.availability ?? "not_included",
                            differs,
                            chosen
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
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${chosen ? "text-[#2563eb]" : "text-[#64748b]"}`}
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
                    chosen ? "text-[#2563eb]" : ""
                  }`}
                >
                  {option.totalInvestmentLabel}
                </p>
              ) : null}

              {choosable ? (
                <button
                  type="button"
                  onClick={() => onChoose!(option.optionKey)}
                  aria-pressed={chosen}
                  disabled={pending}
                  className={`mt-3 ${
                    chosen ? PROPOSAL_PACKET_CHOICE_BUTTON_CHOSEN : PROPOSAL_PACKET_CHOICE_BUTTON
                  }`}
                  data-proposal-choose-option={option.optionKey}
                >
                  {chosen ? (
                    <>
                      <IconCheck className="h-4 w-4 shrink-0" />
                      <span>{PROPOSAL_CUSTOMER_PACKET_CHOSEN_BADGE}</span>
                    </>
                  ) : (
                    <span>{proposalCustomerPacketChooseCta(option.label)}</span>
                  )}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
