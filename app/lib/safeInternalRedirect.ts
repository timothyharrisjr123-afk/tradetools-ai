/**
 * Safe same-origin internal redirects for auth return (login / signup / callback).
 * Blocks open redirects, protocol URLs, and foreign origins.
 */

/**
 * Parse a candidate redirect into a same-origin absolute path, or null.
 * Allows FieldDive app paths (/, /tools/..., /login, etc.).
 * Rejects //..., scheme-relative, absolute URLs with :, and empty values.
 */
export function parseSafeInternalRedirect(
  candidate: string | null | undefined
): string | null {
  if (candidate == null) return null;
  let value = String(candidate).trim();
  if (!value) return null;

  if (/%2f|%3a/i.test(value)) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  value = value.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  // Reject scheme or host injection (e.g. /\\evil, /http:..., path:port tricks).
  if (value.includes("://")) return null;
  if (value.includes("\\")) return null;
  if (value.includes("@")) return null;
  if (/^\/[^/]*:/i.test(value)) return null;
  if (value.includes(":")) return null;

  // Normalize: drop CR/LF and keep path + query + hash only via URL against fixed origin.
  try {
    const parsed = new URL(value, "https://fielddive.internal");
    if (parsed.username || parsed.password || parsed.host !== "fielddive.internal") {
      return null;
    }
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!path.startsWith("/") || path.startsWith("//")) return null;
    return path;
  } catch {
    return null;
  }
}

/** Resolved destination after auth, defaulting to home. */
export function resolveAuthReturnPath(
  candidate: string | null | undefined,
  fallback = "/"
): string {
  return parseSafeInternalRedirect(candidate) ?? fallback;
}

/** Encode redirectTo for embedding in /login or /auth/callback query strings. */
export function buildLoginHrefWithReturn(redirectTo: string | null | undefined): string {
  const safe = parseSafeInternalRedirect(redirectTo);
  if (!safe || safe === "/") return "/login";
  return `/login?redirectTo=${encodeURIComponent(safe)}`;
}

export function buildSignupHrefWithReturn(redirectTo: string | null | undefined): string {
  const safe = parseSafeInternalRedirect(redirectTo);
  if (!safe || safe === "/") return "/signup";
  return `/signup?redirectTo=${encodeURIComponent(safe)}`;
}

/** Auth callback URL that preserves a safe post-auth destination. */
export function buildAuthCallbackUrl(
  origin: string,
  redirectTo: string | null | undefined
): string {
  const base = `${origin.replace(/\/$/, "")}/auth/callback`;
  const safe = parseSafeInternalRedirect(redirectTo);
  if (!safe || safe === "/") return base;
  return `${base}?redirectTo=${encodeURIComponent(safe)}`;
}
