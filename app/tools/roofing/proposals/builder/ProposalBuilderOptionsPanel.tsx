import { Info } from "lucide-react";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";

type ProposalBuilderOptionsPanelProps = {
  graph: ProposalTemplateGraph;
  selectedOptionId: string | null;
};

type DetailRow = {
  label: string;
  value: string | null;
  placeholder: boolean;
};

/**
 * 3J4B8 — read-only package detail surface for the Options tab.
 *
 * The package cards remain the only selector. This panel never selects or
 * persists. Differentiator values shown here are draft/template placeholders
 * (or derived from the template option summary) — clearly labeled, never
 * presented as confirmed catalog truth.
 */
export default function ProposalBuilderOptionsPanel({
  graph,
  selectedOptionId,
}: ProposalBuilderOptionsPanelProps) {
  const options = sortTemplateOptionsByOrder(graph.options);
  const selectedOption =
    options.find((o) => o.id === selectedOptionId) ?? options[0] ?? null;

  if (!selectedOption) {
    return (
      <p className="text-sm text-slate-500">
        No customer-facing options are installed on this template.
      </p>
    );
  }

  const label =
    (selectedOption.customer_label ?? selectedOption.name).trim() || selectedOption.name;
  const meta = resolvePackageMeta(label);
  const [shingleGrade, underlayment] = meta.bullets;

  const rows: DetailRow[] = [
    { label: "Customer-facing description", value: meta.description, placeholder: true },
    { label: "Shingle grade", value: shingleGrade ?? null, placeholder: true },
    { label: "Underlayment", value: underlayment ?? null, placeholder: true },
    { label: "Warranty", value: null, placeholder: true },
    { label: "Ventilation", value: null, placeholder: true },
    { label: "Upgrade notes", value: null, placeholder: true },
    { label: "Exclusions", value: null, placeholder: true },
    { label: "Included / excluded details", value: null, placeholder: true },
  ];

  // 3J4E: split present vs. missing so we don't repeat ugly "Not set" rows.
  // Real values render as clean spec rows; the rest collapse into a single calm
  // "to complete later" group instead of N italic placeholder lines.
  const presentRows = rows.filter((row) => Boolean(row.value));
  const missingLabels = rows.filter((row) => !row.value).map((row) => row.label);

  const showInternalName =
    Boolean((selectedOption.name ?? "").trim()) &&
    Boolean(selectedOption.customer_label) &&
    selectedOption.name !== selectedOption.customer_label;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Package details
        </p>
        {showInternalName ? (
          <p className="mt-0.5 text-xs text-slate-500">Internal name: {selectedOption.name}</p>
        ) : null}
      </div>

      {presentRows.length > 0 ? (
        <dl className="divide-y divide-slate-200/70">
          {presentRows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-2">
              <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
              <dd className="max-w-[60%] text-right text-sm text-slate-700">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {missingLabels.length > 0 ? (
        <div className="rounded-md border border-slate-200/70 bg-white px-3 py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-600">Details to complete later</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                {missingLabels.join(" · ")}
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                Customer-facing option details are added in a later editing phase.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
