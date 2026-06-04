import { CATALOG_ROADMAP_OPTIONS } from "@/app/admin/catalog/catalogAdminConstants";

export default function CatalogRoadmapFootnote() {
  return (
    <section className="rounded-md border border-dashed border-slate-200/90 bg-slate-50/60 px-4 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Later</h2>
      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
        {CATALOG_ROADMAP_OPTIONS.map((item) => (
          <li key={item.title}>
            <span className="font-medium text-slate-700">{item.title}</span>
            <span className="text-slate-400"> · </span>
            {item.description}
          </li>
        ))}
        <li>
          <span className="font-medium text-slate-700">Instant Estimator &amp; material orders</span>
          <span className="text-slate-400"> · </span>
          Will build on this catalog after proposals are in place.
        </li>
      </ul>
    </section>
  );
}
