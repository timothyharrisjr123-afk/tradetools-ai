export type TemplateSetupReadStatus = "idle" | "loading" | "ready" | "error";

export type TemplateSetupApplyResult<T> = {
  status: TemplateSetupReadStatus;
  templates: T[];
  error: string | null;
};

/**
 * Template setup is secondary enrichment.
 * A failed read must not fabricate "no templates configured".
 */
export function applyTemplateSetupFetchResult<T>(input: {
  previousTemplates: readonly T[];
  result: { ok: true; templates: readonly T[] } | { ok: false; error: string };
}): TemplateSetupApplyResult<T> {
  if (input.result.ok) {
    return {
      status: "ready",
      templates: [...input.result.templates],
      error: null,
    };
  }
  return {
    status: "error",
    templates: [...input.previousTemplates],
    error: input.result.error.trim() || "Templates could not be loaded.",
  };
}
