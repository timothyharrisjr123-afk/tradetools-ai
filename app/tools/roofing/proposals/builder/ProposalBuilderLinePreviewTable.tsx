import type { ProposalPreviewLineRow } from "@/app/lib/proposalBuilderPreview";
import { BUILDER_LINE_LIST_FOOTER, BUILDER_PROPOSAL_LINE_ROW } from "./proposalBuilderConstants";

type ProposalBuilderLinePreviewTableProps = {
  rows: ProposalPreviewLineRow[];
  sectionTitle: string;
};

function LineMetaDetail({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <span>
      <span className="text-slate-400">{label}: </span>
      <span>{value}</span>
    </span>
  );
}

export default function ProposalBuilderLinePreviewTable({
  rows,
  sectionTitle,
}: ProposalBuilderLinePreviewTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-slate-500">No line items in {sectionTitle}.</p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-slate-200/80">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`${BUILDER_PROPOSAL_LINE_ROW} ${row.missingCatalog ? "bg-amber-50/40" : ""}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-slate-900">{row.displayName}</p>
                {row.missingCatalog ? (
                  <p className="mt-1 text-xs text-amber-800">Linked catalog item missing</p>
                ) : null}
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <LineMetaDetail label="Unit" value={row.unitLabel} />
                  <LineMetaDetail label="Qty source" value={row.quantitySourceLabel} />
                  <LineMetaDetail label="Qty rule" value={row.quantityRuleLabel} />
                  <LineMetaDetail label="Role" value={row.roleLabel} />
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Catalog setup price
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-slate-700">{row.catalogSetupPriceLabel}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className={BUILDER_LINE_LIST_FOOTER}>
        Catalog setup prices are reference only. No proposal totals or customer contract amounts.
      </p>
    </div>
  );
}
