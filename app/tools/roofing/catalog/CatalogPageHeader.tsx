export default function CatalogPageHeader() {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Catalog</h1>
      <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
        Reusable company catalog items — materials, labor, fees, and quantity rules — that power
        proposal templates, proposals, material orders, and future pricing architecture. This is
        account-wide setup, not per job. Changes here do not run the estimator or pricing engine.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Separate from legacy Price Book (<code className="text-[11px]">service_items</code> in the
        sidebar). Use Catalog for measurement-driven templates and proposals.
      </p>
    </header>
  );
}
