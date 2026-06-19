import { ChevronRight } from "lucide-react";
import type { WorkbenchLineDetailMeta } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";

function LineMetaDetail({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-500">{value}</span>
    </span>
  );
}

type ProposalBuilderWorkbenchLineDetailsProps = {
  detailMeta: WorkbenchLineDetailMeta;
};

/**
 * R17C2 — default-closed contractor line detail disclosure (workbench, not Preview).
 */
export default function ProposalBuilderWorkbenchLineDetails({
  detailMeta,
}: ProposalBuilderWorkbenchLineDetailsProps) {
  const entries = [
    { label: "Source", value: detailMeta.source },
    { label: "Rule", value: detailMeta.rule },
    { label: "Unit", value: detailMeta.unit },
    { label: "Role", value: detailMeta.role },
  ].filter((entry) => entry.value && entry.value !== "—");

  const statusLabel = detailMeta.resolvedStatus;
  const hasContent = entries.length > 0 || statusLabel != null;

  if (!hasContent) return null;

  return (
    <details className="group mt-1">
      <summary className="inline-flex cursor-pointer list-none items-center gap-0.5 text-[10px] font-medium text-slate-400/90 hover:text-slate-500 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-2.5 w-2.5 shrink-0 transition-transform group-open:rotate-90"
          aria-hidden
        />
        Details
      </summary>
      <div className="mt-1 space-y-0.5 border-l border-slate-200/60 pl-2">
        {entries.length > 0 ? (
          <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-snug text-slate-400">
            {entries.map((entry) => (
              <LineMetaDetail key={entry.label} label={entry.label} value={entry.value} />
            ))}
          </p>
        ) : null}
        {statusLabel ? (
          <p className="text-[10px] leading-snug text-slate-400">Status: {statusLabel}</p>
        ) : null}
      </div>
    </details>
  );
}
