/**
 * Attention detail A→B ownership. Same standard as Job Card / Calendar / Preview.
 */
export function shouldApplyAttentionDetailResult(input: {
  requestedJobId: string;
  currentJobId: string | null | undefined;
  generation: number;
  currentGeneration: number;
}): boolean {
  const requested = String(input.requestedJobId ?? "").trim();
  const current = String(input.currentJobId ?? "").trim();
  if (!requested || !current) return false;
  if (requested !== current) return false;
  return input.generation === input.currentGeneration;
}
