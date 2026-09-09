import Stripe from "stripe";

/**
 * A mutation is ambiguous only when Stripe may have received or executed it
 * but FieldDive did not receive an authoritative response.
 */
export function stripeMutationErrorIsAmbiguous(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError)) return false;
  if (error instanceof Stripe.errors.StripeConnectionError) return true;
  return typeof error.statusCode === "number" && error.statusCode >= 500;
}
