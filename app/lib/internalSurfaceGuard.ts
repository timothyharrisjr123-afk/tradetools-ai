/**
 * Internal review surfaces (dev harnesses) render only in local development and
 * test runs. Every production build (`next build` / Vercel) resolves to not-found.
 */
export function isInternalReviewSurfaceEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}
