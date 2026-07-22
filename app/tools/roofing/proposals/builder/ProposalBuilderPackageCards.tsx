"use client";

import { Check, Crown, Shield, Sparkles } from "lucide-react";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import { packageChoiceGridClass } from "@/app/tools/roofing/templates/templatesWorkspaceFlow";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  BUILDER_PACKAGE_CARD,
  BUILDER_PACKAGE_CARD_COMPACT,
  BUILDER_PACKAGE_CARD_IDLE,
  BUILDER_PACKAGE_CARD_SELECTED,
} from "./proposalBuilderConstants";

import type { PackageMeta } from "@/app/lib/proposalPackagePresentation";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";
import { filterActiveTemplateOptions } from "@/app/tools/roofing/templates/templatesPackageStructurePlanner";

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
  const options = sortTemplateOptionsByOrder(
    filterActiveTemplateOptions(graph.options)
  );
  const cardBase = compact ? BUILDER_PACKAGE_CARD_COMPACT : BUILDER_PACKAGE_CARD;

  if (options.length === 0) {
    return <p className="text-sm text-slate-500">No packages on this template.</p>;
  }

  const gridClass = packageChoiceGridClass(options.length);
  return (
    <div
      className={gridClass}
      role="radiogroup"
      aria-label="Proposal packages"
      data-builder-package-cards
      data-builder-package-card-count={options.length}
    >
      {options.map((option) => {
        const label = (option.customer_label ?? option.name).trim() || option.name;
        const meta = resolvePackageMeta(label, option.description);
        const accent = ACCENT_STYLES[meta.accent];
        const selected = option.id === selectedOptionId;
        const { Icon } = accent;

        return (
          <div
            key={option.id}
            className={`${cardBase} h-full w-full ${
              selected ? BUILDER_PACKAGE_CARD_SELECTED : BUILDER_PACKAGE_CARD_IDLE
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelectOption(option.id)}
              className="flex flex-1 flex-col text-left"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.iconBg}`}
                >
                  <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14.5px] font-semibold leading-snug text-slate-950">
                      {label}
                    </p>
                    {selected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        <Check className="h-2.5 w-2.5" aria-hidden />
                        Current
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${accent.chip}`}
                      >
                        Available
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                    {meta.description}
                  </p>
                </div>
              </div>

              <div
                className={`${compact ? "mt-3" : "mt-3.5"} space-y-1 text-[12.5px] leading-snug text-slate-700`}
              >
                {meta.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </button>

            {onViewDetails ? (
              <div className={`mt-auto ${compact ? "pt-3" : "pt-3.5"}`}>
                <button
                  type="button"
                  onClick={() => onViewDetails(option.id)}
                  className="text-[12.5px] font-semibold text-blue-700 hover:text-blue-800"
                >
                  View details
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
