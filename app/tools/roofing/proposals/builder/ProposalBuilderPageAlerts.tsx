import { Info } from "lucide-react";
import {
  BUILDER_READ_ONLY_ALERT_COMPACT,
  BUILDER_READ_ONLY_ALERT_COMPACT_BODY,
  BUILDER_READ_ONLY_ALERT_COMPACT_BODY_SETUP,
  BUILDER_STAGE,
} from "./proposalBuilderConstants";

type ProposalBuilderPageAlertsProps = {
  loadError: string | null;
  shellReady: boolean;
  /** R17B — saved draft path shows Customer Preview availability copy. */
  hasPersistedDraft?: boolean;
};

export default function ProposalBuilderPageAlerts({
  loadError,
  shellReady,
  hasPersistedDraft = false,
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
          <div className={BUILDER_READ_ONLY_ALERT_COMPACT} role="status">
            <Info className="h-3.5 w-3.5 shrink-0 text-amber-700/80" aria-hidden />
            <span>
              {hasPersistedDraft
                ? BUILDER_READ_ONLY_ALERT_COMPACT_BODY
                : BUILDER_READ_ONLY_ALERT_COMPACT_BODY_SETUP}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
