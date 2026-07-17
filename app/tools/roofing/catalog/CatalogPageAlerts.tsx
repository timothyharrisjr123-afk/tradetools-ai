import { CATALOG_ERROR_BANNER, CATALOG_MESSAGE_BANNER } from "./catalogConstants";

type CatalogPageAlertsProps = {
  loadError: string | null;
  message: string | null;
  onRetryLoad?: () => void;
};

export default function CatalogPageAlerts({
  loadError,
  message,
  onRetryLoad,
}: CatalogPageAlertsProps) {
  if (!loadError && !message) {
    return null;
  }

  return (
    <div className="space-y-3">
      {loadError ? (
        <div className={CATALOG_ERROR_BANNER} role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{loadError}</p>
            {onRetryLoad ? (
              <button
                type="button"
                onClick={onRetryLoad}
                className="shrink-0 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-50"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {message ? <div className={CATALOG_MESSAGE_BANNER}>{message}</div> : null}
    </div>
  );
}
