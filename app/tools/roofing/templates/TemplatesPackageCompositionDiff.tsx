"use client";

import {
  formatStepUpChangeSummary,
  groupCompositionDiffForDisplay,
  type PackageCompositionDiff,
} from "@/app/lib/proposalTemplatePackageCompositionDiff";

function formatUnitPriceCents(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

type TemplatesPackageStepUpSummaryProps = {
  diff: PackageCompositionDiff;
  expanded: boolean;
  onToggle: () => void;
};

/** Compact step-up line + progressive View changes. */
export function TemplatesPackageStepUpSummary({
  diff,
  expanded,
  onToggle,
}: TemplatesPackageStepUpSummaryProps) {
  if (!diff.isComparison) {
    return (
      <p
        className="mt-2 text-[11px] font-medium text-slate-600"
        data-templates-composition-step-up-base
      >
        Base package
      </p>
    );
  }

  const summary = formatStepUpChangeSummary(diff);
  if (!summary) return null;

  return (
    <div
      className="mt-2 space-y-1.5"
      data-templates-composition-diff-summary
      data-templates-composition-diff-target={diff.targetPackageId}
      data-templates-composition-diff-base={diff.basePackageId}
      data-templates-composition-step-up
    >
      <p className="text-[11px] font-medium leading-snug text-slate-600">{summary}</p>
      {diff.changeCount > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="text-[11px] font-semibold text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline"
          data-templates-view-changes
          aria-expanded={expanded}
        >
          {expanded ? "Hide changes" : "View changes"}
        </button>
      ) : null}
    </div>
  );
}

type TemplatesPackageCompositionDiffDetailProps = {
  diff: PackageCompositionDiff;
};

/** Expanded step-up detail — only non-empty groups. */
export default function TemplatesPackageCompositionDiffDetail({
  diff,
}: TemplatesPackageCompositionDiffDetailProps) {
  if (!diff.isComparison || diff.changeCount === 0) return null;

  const groups = groupCompositionDiffForDisplay(diff.entries);

  return (
    <div
      className="mt-2 space-y-2.5 border-t border-slate-100 pt-2"
      data-templates-composition-diff-detail
      data-templates-composition-diff-target={diff.targetPackageId}
    >
      {groups.map((group) => (
        <div
          key={group.id}
          className="space-y-1.5"
          data-templates-composition-diff-group={group.id}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {group.id === "optional" ? "Optional upgrades" : group.label}
          </p>
          {group.note ? (
            <p className="text-[11px] leading-snug text-slate-500">{group.note}</p>
          ) : null}
          <ul className="space-y-1.5">
            {group.entries.map((entry, index) => {
              const basePrice = formatUnitPriceCents(entry.base?.unitPriceCents);
              const targetPrice = formatUnitPriceCents(entry.target?.unitPriceCents);
              return (
                <li
                  key={`${entry.kind}-${entry.title}-${index}`}
                  className="text-xs leading-snug text-slate-700"
                  data-templates-composition-diff-entry={entry.kind}
                >
                  <p className="font-medium text-slate-900">{entry.title}</p>
                  {entry.kind === "LABEL_ONLY" && entry.target?.productName ? (
                    <p className="mt-0.5 text-slate-600">
                      Catalog product: {entry.target.productName}
                    </p>
                  ) : null}
                  {entry.kind === "PRODUCT_REPLACEMENT" && entry.target?.productName ? (
                    <p className="mt-0.5 text-slate-600">
                      Catalog product: {entry.target.productName}
                    </p>
                  ) : null}
                  {entry.kind === "PRODUCT_REPLACEMENT" && entry.base?.productName ? (
                    <p className="mt-0.5 text-slate-600">
                      Replaces: {entry.base.productName}
                    </p>
                  ) : null}
                  {entry.kind === "PRODUCT_REPLACEMENT" && basePrice && targetPrice ? (
                    <p className="mt-0.5 tabular-nums text-slate-600">
                      Unit price: {basePrice} → {targetPrice}
                    </p>
                  ) : null}
                  {entry.kind !== "LABEL_ONLY" && entry.kind !== "PRODUCT_REPLACEMENT" ? (
                    <p className="mt-0.5 text-slate-500">{entry.detail}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
