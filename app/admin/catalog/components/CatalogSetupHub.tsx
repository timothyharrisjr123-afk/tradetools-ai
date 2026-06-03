import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";
import { CARD, SETUP_STEP_ACTIVE_RING, SETUP_STEP_CARD } from "../catalogAdminConstants";
import { STARTER_DEFINITION_COUNT } from "../catalogAdminUtils";

type CatalogSetupHubProps = {
  starterInstalled: boolean;
  starterDisplay: string;
  readiness: CatalogReadinessSummary;
  unpricedCount: number;
  loading: boolean;
  busy: boolean;
  templateReadinessReady: boolean;
  installButtonLabel: string;
  step1CardClass: string;
  step2CardClass: string;
  onInstallStarter: () => void;
  onStartPricingQueue: () => void;
};

export default function CatalogSetupHub({
  starterInstalled,
  starterDisplay,
  readiness,
  unpricedCount,
  loading,
  busy,
  templateReadinessReady,
  installButtonLabel,
  step1CardClass,
  step2CardClass,
  onInstallStarter,
  onStartPricingQueue,
}: CatalogSetupHubProps) {
  return (
    <section className={CARD} aria-labelledby="catalog-setup-hub-heading">
      <h2 id="catalog-setup-hub-heading" className="text-base font-semibold text-slate-900">
        Catalog setup
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Work through these steps before proposal templates and Proposal Builder are enabled.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={step1CardClass}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              1
            </span>
            <span
              className={
                starterInstalled
                  ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                  : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"
              }
            >
              {starterInstalled ? "Installed" : "Not installed"}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Starter catalog</h3>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
            Install {STARTER_DEFINITION_COUNT} reusable roofing line items with measurement quantity
            rules. Creates catalog rows only — not proposals and not estimator pricing changes.
          </p>
          <p className="mt-2 text-xs text-slate-500">{starterDisplay}</p>
          <button
            type="button"
            onClick={onInstallStarter}
            disabled={busy}
            className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {installButtonLabel}
          </button>
          {starterInstalled && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              All starter seed keys are present. Recheck installs any missing rows without
              duplicating existing items.
            </p>
          )}
        </div>

        <div className={step2CardClass}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              2
            </span>
            <span
              className={
                unpricedCount === 0 && readiness.activeItemCount > 0
                  ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
              }
            >
              {loading ? "…" : `${readiness.pricedItemCount} priced · ${unpricedCount} unpriced`}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Configure pricing</h3>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
            Set unit prices and customer-facing labels on the items you plan to use. Proposal
            templates stay locked until catalog setup meets readiness below.
          </p>
          {readiness.activeItemCount === 0 ? (
            <p className="mt-3 text-xs font-medium text-slate-500">
              Install the starter catalog first.
            </p>
          ) : unpricedCount > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-cyan-800">
                Configure unpriced items in the table below.
              </p>
              <button
                type="button"
                onClick={onStartPricingQueue}
                disabled={busy}
                className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Price {unpricedCount} item{unpricedCount === 1 ? "" : "s"}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs font-medium text-emerald-800">
              All active items have unit prices set.
            </p>
          )}
        </div>

        <div className={`${SETUP_STEP_CARD} opacity-95`}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600">
              3
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
              After catalog (3G6)
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Templates next</h3>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
            Proposal templates will use these catalog items after setup is ready. The templates route
            is not available yet — coming in stage 3G6 after catalog alignment.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {templateReadinessReady
              ? "Catalog meets template readiness — templates UI is the next implementation stage."
              : "Complete steps 1–2 and pricing readiness before templates."}
          </p>
        </div>
      </div>
    </section>
  );
}
