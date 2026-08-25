/**
 * Server/client agreement for which /tools/roofing deep-link is a clean Job Card.
 * Clean Job Card must not load the estimator workspace module.
 */
export function isCleanJobCardRoute(input: {
  entry?: string | null;
  job?: string | null;
  loadSaved?: string | null;
}): boolean {
  const entry = String(input.entry ?? "").trim();
  const job = String(input.job ?? "").trim();
  const loadSaved = String(input.loadSaved ?? "").trim();
  return entry === "job-card" && job.length > 0 && loadSaved.length === 0;
}
