import { CATALOG_ERROR_BANNER, CATALOG_MESSAGE_BANNER } from "./catalogConstants";

type CatalogPageAlertsProps = {
  loadError: string | null;
  message: string | null;
};

export default function CatalogPageAlerts({ loadError, message }: CatalogPageAlertsProps) {
  if (!loadError && !message) {
    return null;
  }

  return (
    <div className="space-y-3">
      {loadError ? (
        <div className={CATALOG_ERROR_BANNER} role="alert">
          {loadError}
        </div>
      ) : null}
      {message ? <div className={CATALOG_MESSAGE_BANNER}>{message}</div> : null}
    </div>
  );
}
