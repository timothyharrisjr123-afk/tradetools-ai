import { CATALOG_PAGE_SUBTITLE } from "@/app/lib/catalogContractorLabels";

export default function CatalogPageHeader() {
  return (
    <header className="shrink-0">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Catalog</h1>
      <p className="mt-0.5 text-sm text-slate-600">{CATALOG_PAGE_SUBTITLE}</p>
    </header>
  );
}
