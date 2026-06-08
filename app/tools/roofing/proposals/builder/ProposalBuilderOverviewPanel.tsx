import type { ReactNode } from "react";
import { AlertCircle, ClipboardList, FileStack, Layers, Package } from "lucide-react";
import {
  BUILDER_OVERVIEW_CARD,
  BUILDER_OVERVIEW_CARD_WARNING,
  BUILDER_OVERVIEW_PREVIEW_NOTICE,
  BUILDER_PRICING_PREVIEW_CONFIGURED_COPY,
  BUILDER_PRICING_PREVIEW_PLACEHOLDER_COPY,
  formatOptionPricingTabStatusLabel,
} from "./proposalBuilderConstants";

type OverviewCardProps = {
  icon: ReactNode;
  iconTone?: "default" | "warning";
  label: string;
  value: string;
  subtext?: string;
  chip?: string;
  chipTone?: "included" | "warning";
  attention?: boolean;
};

function OverviewCard({
  icon,
  iconTone = "default",
  label,
  value,
  subtext,
  chip,
  chipTone,
  attention = false,
}: OverviewCardProps) {
  const chipClass =
    chipTone === "warning"
      ? "bg-amber-200 text-amber-900"
      : "bg-blue-100 text-blue-800";

  const iconWrapClass =
    iconTone === "warning"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600";

  return (
    <div className={`${BUILDER_OVERVIEW_CARD} ${attention ? BUILDER_OVERVIEW_CARD_WARNING : ""}`}>
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrapClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <p className="text-[17px] font-semibold leading-tight text-slate-900">{value}</p>
          {chip ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${chipClass}`}
            >
              {chip}
            </span>
          ) : null}
        </div>
        {subtext ? <p className="mt-2 text-xs text-slate-500">{subtext}</p> : null}
      </div>
    </div>
  );
}

type ProposalBuilderOverviewPanelProps = {
  recordLabel: string;
  packageLabel: string;
  templateName: string;
  pricingComplete: boolean | null;
  proposalOverviewText: string;
  proposalId: string | null;
  pricingPolicyConfigured: boolean;
};

export default function ProposalBuilderOverviewPanel({
  recordLabel,
  packageLabel,
  templateName,
  pricingComplete,
  proposalOverviewText,
  proposalId,
  pricingPolicyConfigured,
}: ProposalBuilderOverviewPanelProps) {
  const pricingValue =
    pricingComplete === null
      ? "—"
      : formatOptionPricingTabStatusLabel(pricingComplete);

  const pricingNeedsAttention = pricingComplete === false;

  const previewNotice = pricingPolicyConfigured
    ? BUILDER_PRICING_PREVIEW_CONFIGURED_COPY
    : BUILDER_PRICING_PREVIEW_PLACEHOLDER_COPY;

  return (
    <div className="space-y-7">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          label="Record"
          value={recordLabel}
          subtext="Draft proposal"
        />
        <OverviewCard
          icon={<Package className="h-5 w-5" aria-hidden />}
          label="Package"
          value={packageLabel}
          chip="Included"
          chipTone="included"
        />
        <OverviewCard
          icon={<FileStack className="h-5 w-5" aria-hidden />}
          label="Template"
          value={templateName}
        />
        <OverviewCard
          icon={<Layers className="h-5 w-5" aria-hidden />}
          iconTone="warning"
          label="Pricing status"
          value={pricingValue}
          chip={pricingNeedsAttention ? "Requires attention" : undefined}
          chipTone="warning"
          attention={pricingNeedsAttention}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] lg:items-start">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">Proposal overview</h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{proposalOverviewText}</p>
        </div>
        {proposalId ? (
          <div className="min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/60 px-4 py-4 lg:mt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Draft proposal
            </p>
            <code className="mt-2 block break-all font-mono text-[11px] leading-snug text-slate-700">
              {proposalId}
            </code>
          </div>
        ) : null}
      </div>

      <div className={BUILDER_OVERVIEW_PREVIEW_NOTICE}>
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
        <p>{previewNotice}</p>
      </div>
    </div>
  );
}
