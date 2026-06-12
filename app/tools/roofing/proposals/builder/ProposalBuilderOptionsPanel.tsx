import { Info } from "lucide-react";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import { resolvePackageMeta } from "./ProposalBuilderPackageCards";

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

  const showInternalName =
    Boolean((selectedOption.name ?? "").trim()) &&
    Boolean(selectedOption.customer_label) &&
    selectedOption.name !== selectedOption.customer_label;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Package details</h3>
        <p className="mt-1 text-xs text-slate-500">
          Customer-facing option. Use “Change package” to switch the selected package.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-4 py-4">
        <p className="text-base font-semibold text-slate-900">{label}</p>
        {showInternalName ? (
          <p className="mt-1 text-xs text-slate-500">Internal name: {selectedOption.name}</p>
        ) : null}

        <div className="mt-3 flex items-start gap-2 rounded-md border border-blue-200/70 bg-blue-50/60 px-3 py-2 text-[11px] leading-snug text-blue-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden />
          <span>
            Draft template detail — placeholder differentiators shown for layout. Editing
            customer-facing option details comes in a later phase.
          </span>
        </div>

        <dl className="mt-4 divide-y divide-slate-200/70">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-2">
              <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
              <dd className="max-w-[60%] text-right text-sm text-slate-700">
                {row.value ? (
                  row.value
                ) : (
                  <span className="text-xs italic text-slate-400">Not set (placeholder)</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
