/**
 * D2 — Legacy unaudited email/send routes are retired.
 * Canonical proposal delivery: POST /api/proposals/send only.
 */

export const LEGACY_DELIVERY_ROUTE_GONE_CODE = "legacy_delivery_route_retired";

export const LEGACY_DELIVERY_ROUTE_GONE_MESSAGE =
  "This send path is retired. Use the proposal Preview send flow.";

export const LEGACY_APPROVE_CONFIRM_GONE_MESSAGE =
  "This legacy approval confirmation path is retired.";

export const LEGACY_EMAIL_FOLLOWUP_GONE_MESSAGE =
  "Follow-up email send is retired. Use the proposal Preview send flow to email customers.";

export function legacyDeliveryRouteGoneBody(message: string = LEGACY_DELIVERY_ROUTE_GONE_MESSAGE) {
  return {
    ok: false,
    success: false,
    code: LEGACY_DELIVERY_ROUTE_GONE_CODE,
    error: message,
    message,
  };
}
