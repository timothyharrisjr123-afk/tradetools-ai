/**
 * Phase 6 — read-only contractor quantity status copy for Builder helper rail.
 *
 * Maps internal quantity preflight trust → short non-blocking labels.
 * No Send gate, no auto-refresh CTA, no customer/public exposure, no mode switch.
 */

import type {
  QuantityPreflightTrustSeverity,
  QuantityPreflightTrustSignal,
  QuantityPreflightTrustStatus,
} from "@/app/lib/proposalBuilderTrustSignals";

export const BUILDER_QUANTITY_SOURCES_RAIL_LABEL = "Quantity sources" as const;

export const BUILDER_QUANTITY_STATUS_LABEL = {
  current: "Quantity sources current",
  unknown: "Quantity sources need review",
  stale: "Quantity sources changed",
} as const satisfies Record<QuantityPreflightTrustStatus, string>;

export const BUILDER_QUANTITY_STATUS_HELPER = {
  current: "Matches the saved draft.",
  unknown: "Contractor review only.",
  stale: "Contractor review only.",
} as const satisfies Record<QuantityPreflightTrustStatus, string>;

export type BuilderQuantityStatusView = {
  label: typeof BUILDER_QUANTITY_SOURCES_RAIL_LABEL;
  status: QuantityPreflightTrustStatus;
  severity: QuantityPreflightTrustSeverity;
  statusLabel: string;
  helperText: string;
  shouldBlock: false;
  shouldAutoRefresh: false;
  customerVisible: false;
};

/**
 * Present a read-only quantity status view from trust signal.
 * Missing trust → unknown/neutral (honest, non-blocking).
 */
export function presentBuilderQuantityStatus(
  trust: QuantityPreflightTrustSignal | null | undefined
): BuilderQuantityStatusView {
  const status: QuantityPreflightTrustStatus = trust?.status ?? "unknown";
  const severity: QuantityPreflightTrustSeverity =
    trust?.severity ??
    (status === "current" ? "ok" : status === "stale" ? "needs_review" : "neutral");

  return {
    label: BUILDER_QUANTITY_SOURCES_RAIL_LABEL,
    status,
    severity,
    statusLabel: BUILDER_QUANTITY_STATUS_LABEL[status],
    helperText: BUILDER_QUANTITY_STATUS_HELPER[status],
    shouldBlock: false,
    shouldAutoRefresh: false,
    customerVisible: false,
  };
}
