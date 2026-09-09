export type FieldDiveEnvironment = "local" | "test" | "staging" | "production";
export type StripeMode = "test" | "live";

type RuntimeEnvironment = Record<string, string | undefined>;

const FIELD_DIVE_ENVIRONMENTS = new Set<FieldDiveEnvironment>([
  "local",
  "test",
  "staging",
  "production",
]);

export function resolveFieldDiveEnvironment(
  env: RuntimeEnvironment = process.env
): FieldDiveEnvironment {
  const configured = env.FIELDDIVE_ENV?.trim().toLowerCase();
  if (configured) {
    if (!FIELD_DIVE_ENVIRONMENTS.has(configured as FieldDiveEnvironment)) {
      throw new Error("Invalid FIELDDIVE_ENV.");
    }
    return configured as FieldDiveEnvironment;
  }

  if (env.NODE_ENV === "development") return "local";
  if (env.NODE_ENV === "test") return "test";
  throw new Error("Missing env: FIELDDIVE_ENV");
}

export function expectedStripeMode(environment: FieldDiveEnvironment): StripeMode {
  return environment === "production" ? "live" : "test";
}

export function stripeSecretKeyMode(key: string): StripeMode | null {
  if (/^(?:sk|rk)_live_/.test(key)) return "live";
  if (/^(?:sk|rk)_test_/.test(key)) return "test";
  return null;
}

export function requireStripeSecretKey(
  env: RuntimeEnvironment = process.env
): string {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing env: STRIPE_SECRET_KEY");
  const actualMode = stripeSecretKeyMode(key);
  if (!actualMode) throw new Error("Invalid STRIPE_SECRET_KEY mode.");
  const requiredMode = expectedStripeMode(resolveFieldDiveEnvironment(env));
  if (actualMode !== requiredMode) {
    throw new Error("STRIPE_SECRET_KEY mode does not match FIELDDIVE_ENV.");
  }
  return key;
}

export function requireStripeConnectWebhookSecret(
  env: RuntimeEnvironment = process.env
): string {
  const secret = env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("Missing env: STRIPE_CONNECT_WEBHOOK_SECRET");
  if (!secret.startsWith("whsec_")) {
    throw new Error("Invalid STRIPE_CONNECT_WEBHOOK_SECRET.");
  }
  return secret;
}

export function stripeEventModeMatchesEnvironment(
  livemode: boolean,
  env: RuntimeEnvironment = process.env
): boolean {
  const requiredMode = expectedStripeMode(resolveFieldDiveEnvironment(env));
  return livemode === (requiredMode === "live");
}
