import { TEMPLATES_ERROR_BANNER, TEMPLATES_MESSAGE_BANNER } from "./templatesConstants";

type TemplatesPageAlertsProps = {
  loadError: string | null;
  installMessage: string | null;
  installError: string | null;
};

export default function TemplatesPageAlerts({
  loadError,
  installMessage,
  installError,
}: TemplatesPageAlertsProps) {
  if (!loadError && !installMessage && !installError) {
    return null;
  }

  return (
    <div className="space-y-3">
      {loadError ? (
        <p className={TEMPLATES_ERROR_BANNER} role="alert">
          {loadError}
        </p>
      ) : null}
      {installMessage ? (
        <p className={TEMPLATES_MESSAGE_BANNER} role="status">
          {installMessage}
        </p>
      ) : null}
      {installError ? (
        <p className={TEMPLATES_ERROR_BANNER} role="alert">
          {installError}
        </p>
      ) : null}
    </div>
  );
}
