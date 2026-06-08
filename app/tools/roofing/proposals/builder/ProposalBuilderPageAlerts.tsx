import { Info } from "lucide-react";
import {
  BUILDER_READ_ONLY_ALERT,
  BUILDER_READ_ONLY_ALERT_BODY,
  BUILDER_READ_ONLY_ALERT_TITLE,
  BUILDER_STAGE,
} from "./proposalBuilderConstants";

type ProposalBuilderPageAlertsProps = {
  loadError: string | null;
  shellReady: boolean;
};

export default function ProposalBuilderPageAlerts({
  loadError,
  shellReady,
}: ProposalBuilderPageAlertsProps) {
  return (
    <>
      {loadError ? (
        <div
          className={`${BUILDER_STAGE} rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800`}
          role="alert"
        >
          {loadError}
        </div>
      ) : null}
      {shellReady ? (
        <div className={BUILDER_STAGE}>
          <div className={BUILDER_READ_ONLY_ALERT} role="status">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700/80" aria-hidden />
            <div>
              <p className="text-sm font-medium">{BUILDER_READ_ONLY_ALERT_TITLE}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-900/85">
                {BUILDER_READ_ONLY_ALERT_BODY}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
