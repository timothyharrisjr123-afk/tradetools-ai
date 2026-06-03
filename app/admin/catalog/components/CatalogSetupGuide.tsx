import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";
import { CARD } from "../catalogAdminConstants";

type CatalogSetupGuideProps = {
  loading: boolean;
  readiness: CatalogReadinessSummary;
  unpricedCount: number;
  unpricedMaterialCount: number;
  unpricedLaborCount: number;
  unpricedFeeCount: number;
  onJumpToConfigure: () => void;
};

export default function CatalogSetupGuide({
  loading,
  readiness,
  unpricedCount,
  unpricedMaterialCount,
  unpricedLaborCount,
  unpricedFeeCount,
  onJumpToConfigure,
}: CatalogSetupGuideProps) {
  return (
    <section className={CARD} aria-labelledby="catalog-setup-guide-heading">
      <h2 id="catalog-setup-guide-heading" className="text-sm font-semibold text-slate-900">
        Setup guide
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Rules-based guidance only — catalog setup does not change estimator pricing or create
        proposals.
      </p>
      {loading ? (
        <p className="mt-3 text-xs text-slate-500">Loading setup status…</p>
      ) : readiness.activeItemCount === 0 ? (
        <p className="mt-3 text-xs text-slate-600">
          Install the starter catalog, then configure prices on the items you plan to use in
          templates.
        </p>
      ) : unpricedCount > 0 ? (
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">
              You have {unpricedCount} unpriced active item{unpricedCount === 1 ? "" : "s"}.
            </span>{" "}
            Start with materials ({unpricedMaterialCount} unpriced), then labor ({unpricedLaborCount}
            ), then fees ({unpricedFeeCount}).
          </p>
          <p className="text-slate-600">
            Use{" "}
            <button
              type="button"
              onClick={onJumpToConfigure}
              className="font-semibold text-cyan-800 underline decoration-cyan-300 underline-offset-2 hover:text-cyan-900"
            >
              Price {unpricedCount} item{unpricedCount === 1 ? "" : "s"}
            </button>{" "}
            in step 2 above, or scroll to configure items below.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-emerald-800">
          Active catalog items have unit prices. Template setup UI (3G6) is the next stage after
          catalog alignment.
        </p>
      )}
    </section>
  );
}
