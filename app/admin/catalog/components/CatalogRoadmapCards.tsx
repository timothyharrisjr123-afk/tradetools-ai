import { CARD, CATALOG_ROADMAP_OPTIONS, ROADMAP_CARD } from "../catalogAdminConstants";

export default function CatalogRoadmapCards() {
  return (
    <section className={CARD} aria-labelledby="catalog-roadmap-heading">
      <h2 id="catalog-roadmap-heading" className="text-sm font-semibold text-slate-900">
        Expand catalog later
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Planned capabilities — not available in this stage. Shown so the setup path stays clear.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CATALOG_ROADMAP_OPTIONS.map((option) => (
          <div key={option.title} className={ROADMAP_CARD} aria-disabled="true">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">{option.title}</h3>
              <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {option.badge}
              </span>
            </div>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-500">{option.description}</p>
            <button
              type="button"
              disabled
              className="mt-3 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400"
            >
              Coming later
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
