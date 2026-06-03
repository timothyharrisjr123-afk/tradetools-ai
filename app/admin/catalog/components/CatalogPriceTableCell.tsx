import { formatCents, isUnpricedCents } from "../catalogAdminUtils";

export default function CatalogPriceTableCell({
  cents,
}: {
  cents: number | null | undefined;
}) {
  if (isUnpricedCents(cents)) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
        Unpriced
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap tabular-nums text-sm font-medium text-slate-800">
      {formatCents(cents)}
    </span>
  );
}
