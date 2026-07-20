"use client";

import { Check, Crown, Shield, Sparkles } from "lucide-react";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  BUILDER_PACKAGE_CARD,
  BUILDER_PACKAGE_CARD_COMPACT,
  BUILDER_PACKAGE_CARD_IDLE,
  BUILDER_PACKAGE_CARD_SELECTED,
} from "./proposalBuilderConstants";

import type { PackageMeta } from "@/app/lib/proposalPackagePresentation";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";

const ACCENT_STYLES: Record<
  PackageMeta["accent"],
  { iconBg: string; chip: string; Icon: typeof Shield }
> = {
  standard: {
    iconBg: "bg-blue-100 text-blue-700",
    chip: "bg-blue-100 text-blue-800",
    Icon: Shield,
  },
  enhanced: {
    iconBg: "bg-amber-100 text-amber-700",
    chip: "bg-amber-100 text-amber-800",
    Icon: Sparkles,
  },
  premium: {
    iconBg: "bg-violet-100 text-violet-700",
    chip: "bg-violet-100 text-violet-800",
    Icon: Crown,
  },
  default: {
    iconBg: "bg-slate-100 text-slate-600",
    chip: "bg-slate-100 text-slate-700",
    Icon: Shield,
  },
};

type ProposalBuilderPackageCardsProps = {
  graph: ProposalTemplateGraph;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  /** 3J4B8: open the Options detail tab for a package (does not change pricing). */
  onViewDetails?: (optionId: string) => void;
  /** 3J4B flow-focus: lower visual dominance once a package is selected and pricing is blocked. */
  compact?: boolean;
};

export default function ProposalBuilderPackageCards({
  graph,
  selectedOptionId,
  onSelectOption,
  onViewDetails,
  compact = false,
}: ProposalBuilderPackageCardsProps) {
  const options = sortTemplateOptionsByOrder(graph.options);
  const cardBase = compact ? BUILDER_PACKAGE_CARD_COMPACT : BUILDER_PACKAGE_CARD;

  if (options.length === 0) {
    return <p className="text-sm text-slate-500">No packages on this template.</p>;
  }

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      role="radiogroup"
      aria-label="Proposal packages"
      data-builder-package-cards
    >
      {options.map((option) => {
        const label = (option.customer_label ?? option.name).trim() || option.name;
        const meta = resolvePackageMeta(label);
        const accent = ACCENT_STYLES[meta.accent];
        const selected = option.id === selectedOptionId;
        const { Icon } = accent;

        return (
          <div
            key={option.id}
            className={`${cardBase} ${
              selected ? BUILDER_PACKAGE_CARD_SELECTED : BUILDER_PACKAGE_CARD_IDLE
            }`}
          >
            {selected ? (
              <span className="absolute left-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white">
                <Check className="h-3.5 w-3.5" aria-hidden />
              </span>
            ) : null}

            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelectOption(option.id)}
              className="flex flex-1 flex-col text-left"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.iconBg} ${
                    selected ? "ml-3" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-[15px] font-semibold leading-snug text-slate-950">{label}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                    {meta.description}
                  </p>
                </div>
              </div>

              <div
                className={`${compact ? "mt-3" : "mt-4"} space-y-1.5 text-[13px] leading-snug text-slate-700`}
              >
                {meta.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </button>

            <div
              className={`mt-auto flex items-center gap-3 ${
                onViewDetails ? "justify-between" : "justify-end"
              } ${compact ? "pt-3" : "pt-4"}`}
            >
              {onViewDetails ? (
                <button
                  type="button"
                  onClick={() => onViewDetails(option.id)}
                  className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                  View details
                </button>
              ) : null}
              {selected ? (
                <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Current
                </span>
              ) : (
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${accent.chip}`}
                >
                  Available
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
