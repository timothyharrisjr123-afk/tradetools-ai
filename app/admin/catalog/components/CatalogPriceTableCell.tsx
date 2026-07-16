import { formatCents, isUnpricedCents } from "../catalogAdminUtils";
import { CATALOG_CONTRACTOR_LABELS } from "@/app/lib/catalogContractorLabels";

export default function CatalogPriceTableCell({
  cents,
  emptyLabel,
}: {
  cents: number | null | undefined;
  /** When set, empty/unpriced shows this instead of Needs price (e.g. "—" for unit cost). */
  emptyLabel?: string;
}) {
  if (isUnpricedCents(cents)) {
    if (emptyLabel != null) {
      return <span className="tabular-nums text-slate-400">{emptyLabel}</span>;
    }
    return (
      <span className="whitespace-nowrap text-xs font-medium text-amber-800">
        {CATALOG_CONTRACTOR_LABELS.needsPrice}
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap tabular-nums text-sm text-slate-800">
      {formatCents(cents)}
    </span>
  );
}
