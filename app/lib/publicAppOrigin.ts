/**
 * Canonical public app origin for customer-facing URLs.
 * Development may use localhost. Non-development requires explicit HTTPS NEXT_PUBLIC_APP_URL.
 * Request Host / Origin headers never authorize public links in non-development.
 */

export const PUBLIC_ORIGIN_MISCONFIGURED_CODE = "public_origin_misconfigured" as const;

/** Contractor-safe copy — no env names, hosts, or stack details. */
export const PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE =
  "Sending is unavailable because this environment is not configured for customer links.";

export class PublicAppOriginError extends Error {
  readonly code: typeof PUBLIC_ORIGIN_MISCONFIGURED_CODE =
    PUBLIC_ORIGIN_MISCONFIGURED_CODE;

  constructor(message: string = PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE) {
    super(message);
    this.name = "PublicAppOriginError";
  }
}

export function isDevelopmentRuntime(
  nodeEnv: string | undefined | null = process.env.NODE_ENV
): boolean {
  return (nodeEnv ?? "").trim() === "development";
}

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function parseAbsoluteUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/**
 * Normalize a configured origin string for the given runtime.
 * Throws PublicAppOriginError when the value is not allowed.
 */
export function normalizePublicAppOrigin(
  raw: string,
  nodeEnv: string | undefined | null = process.env.NODE_ENV
): string {
  const url = parseAbsoluteUrl(raw);
  if (!url) {
    throw new PublicAppOriginError();
  }

  const loopback = isLoopbackHostname(url.hostname);

  if (isDevelopmentRuntime(nodeEnv)) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new PublicAppOriginError();
    }
    return url.origin;
  }

  if (url.protocol !== "https:") {
    throw new PublicAppOriginError();
  }
  if (loopback) {
    throw new PublicAppOriginError();
  }
  return url.origin;
}

export type ResolvePublicAppOriginInput = {
  nodeEnv?: string | null;
  /** Explicit APP_URL override (tests). Defaults to process.env.NEXT_PUBLIC_APP_URL. */
  appUrl?: string | null;
  /**
   * Development-only fallback when APP_URL is unset.
   * Ignored in non-development. Must itself be a legal development origin if provided.
   * Host / Origin headers must never be passed here in non-development callers.
   */
  developmentFallbackOrigin?: string | null;
};

/**
 * Resolve the canonical public app origin.
 * Non-development: NEXT_PUBLIC_APP_URL only (HTTPS, non-loopback). No Host/Origin substitute.
 * Development: APP_URL if set, else developmentFallbackOrigin if legal, else http://localhost:3000.
 */
export function resolvePublicAppOrigin(
  input: ResolvePublicAppOriginInput = {}
): string {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;
  const configured = (
    input.appUrl !== undefined
      ? input.appUrl
      : process.env.NEXT_PUBLIC_APP_URL
  )
    ?.toString()
    .trim();

  if (configured) {
    return normalizePublicAppOrigin(configured, nodeEnv);
  }

  if (isDevelopmentRuntime(nodeEnv)) {
    const fallback = (input.developmentFallbackOrigin ?? "").trim();
    if (fallback) {
      return normalizePublicAppOrigin(fallback, nodeEnv);
    }
    return "http://localhost:3000";
  }

  throw new PublicAppOriginError();
}

export function isPublicAppOriginError(error: unknown): error is PublicAppOriginError {
  return (
    error instanceof PublicAppOriginError ||
    (typeof error === "object" &&
      error != null &&
      "code" in error &&
      (error as { code?: unknown }).code === PUBLIC_ORIGIN_MISCONFIGURED_CODE)
  );
}
