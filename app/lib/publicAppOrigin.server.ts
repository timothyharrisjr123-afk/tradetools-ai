/**
 * Server entry for canonical public app origin.
 */

import "server-only";

export {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  PublicAppOriginError,
  isDevelopmentRuntime,
  isLoopbackHostname,
  isPublicAppOriginError,
  normalizePublicAppOrigin,
  resolvePublicAppOrigin,
  type ResolvePublicAppOriginInput,
} from "@/app/lib/publicAppOrigin";
