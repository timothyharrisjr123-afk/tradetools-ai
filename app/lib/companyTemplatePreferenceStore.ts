/**
 * FieldDive Company Template Preference Store — R2B preferred setup.
 *
 * public.company_template_preferences
 *
 * Stores which reusable setup FieldDive suggests first for a company
 * workflow (e.g. roofing + proposal). Separate from:
 * - R1 package-option is_default (which package inside a setup)
 * - R2A archive/restore (proposal_templates.status + active)
 *
 * Boundaries:
 * - No package-option writes
 * - No proposal snapshot / draft mutations
 * - No pricing / quantity / send-freeze imports
 * - Migration must be applied before live reads/writes succeed
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { getProposalTemplateById } from "@/app/lib/proposalTemplateStore";

// ---------------------------------------------------------------------------
// Constants — initial roofing proposal preferred setup slot
// ---------------------------------------------------------------------------

export const MODULE_KEY_ROOFING = "roofing" as const;
export const WORKFLOW_KEY_PROPOSAL = "proposal" as const;
export const PREFERENCE_KIND_PREFERRED_SETUP = "preferred_setup" as const;

export const COMPANY_TEMPLATE_PREFERENCE_TABLE = "company_template_preferences";

export const COMPANY_TEMPLATE_PREFERENCE_SELECT_COLUMNS =
  "id, company_id, module_key, workflow_key, preference_kind, template_id, created_at, updated_at";

export type CompanyTemplatePreferenceScope = {
  moduleKey?: string;
  workflowKey?: string;
  preferenceKind?: string;
};

export type CompanyTemplatePreference = {
  id: string;
  company_id: string;
  module_key: string;
  workflow_key: string;
  preference_kind: string;
  template_id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type CompanyTemplatePreferenceRow = {
  id: string;
  company_id: string;
  module_key: string;
  workflow_key: string;
  preference_kind: string;
  template_id: string;
  created_at: string;
  updated_at: string;
};

const TABLE = COMPANY_TEMPLATE_PREFERENCE_TABLE;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function normalizeCompanyId(companyId: string): string | null {
  if (typeof companyId !== "string") return null;
  const id = companyId.trim();
  if (!id || !isUuidLike(id)) return null;
  return id;
}

function normalizeUuid(id: string): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!trimmed || !isUuidLike(trimmed)) return null;
  return trimmed;
}

function resolveScope(scope?: CompanyTemplatePreferenceScope): {
  moduleKey: string;
  workflowKey: string;
  preferenceKind: string;
} {
  return {
    moduleKey: (scope?.moduleKey ?? MODULE_KEY_ROOFING).trim() || MODULE_KEY_ROOFING,
    workflowKey: (scope?.workflowKey ?? WORKFLOW_KEY_PROPOSAL).trim() || WORKFLOW_KEY_PROPOSAL,
    preferenceKind:
      (scope?.preferenceKind ?? PREFERENCE_KIND_PREFERRED_SETUP).trim() ||
      PREFERENCE_KIND_PREFERRED_SETUP,
  };
}

function rowToPreference(row: CompanyTemplatePreferenceRow): CompanyTemplatePreference {
  return {
    id: row.id,
    company_id: row.company_id,
    module_key: row.module_key,
    workflow_key: row.workflow_key,
    preference_kind: row.preference_kind,
    template_id: row.template_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Pure eligibility check for preferred setup — mirrors Job Card eligible rules. */
export function isTemplateEligibleForPreferredSetup(template: {
  status?: string | null;
  active?: boolean | null;
}): boolean {
  if (template.status === "archived") return false;
  if (template.active === false) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getPreferredSetupPreference(
  companyId: string,
  scope?: CompanyTemplatePreferenceScope
): Promise<CompanyTemplatePreference | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[companyTemplatePreferenceStore] getPreferredSetupPreference: Supabase client unavailable"
    );
    return null;
  }

  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error(
      "[companyTemplatePreferenceStore] getPreferredSetupPreference: invalid company id"
    );
    return null;
  }

  const { moduleKey, workflowKey, preferenceKind } = resolveScope(scope);

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COMPANY_TEMPLATE_PREFERENCE_SELECT_COLUMNS)
      .eq("company_id", scopedCompanyId)
      .eq("module_key", moduleKey)
      .eq("workflow_key", workflowKey)
      .eq("preference_kind", preferenceKind)
      .maybeSingle();

    if (error) {
      console.error(
        "[companyTemplatePreferenceStore] getPreferredSetupPreference failed:",
        error.message,
        { companyId: scopedCompanyId, moduleKey, workflowKey, preferenceKind }
      );
      return null;
    }
    if (!data) return null;
    return rowToPreference(data as CompanyTemplatePreferenceRow);
  } catch (err) {
    console.error("[companyTemplatePreferenceStore] getPreferredSetupPreference error:", err);
    return null;
  }
}

export async function getPreferredSetupTemplateId(
  companyId: string,
  scope?: CompanyTemplatePreferenceScope
): Promise<string | null> {
  const preference = await getPreferredSetupPreference(companyId, scope);
  return preference?.template_id ?? null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Upsert the preferred setup for a company workflow slot.
 * Rejects archived / inactive templates. Does not touch package-option defaults.
 */
export async function setPreferredSetup(
  companyId: string,
  templateId: string,
  scope?: CompanyTemplatePreferenceScope
): Promise<CompanyTemplatePreference | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[companyTemplatePreferenceStore] setPreferredSetup: Supabase client unavailable"
    );
    return null;
  }

  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error("[companyTemplatePreferenceStore] setPreferredSetup: invalid company id");
    return null;
  }

  const scopedTemplateId = normalizeUuid(templateId);
  if (!scopedTemplateId) {
    console.error("[companyTemplatePreferenceStore] setPreferredSetup: invalid template id");
    return null;
  }

  const template = await getProposalTemplateById(scopedTemplateId, {
    companyId: scopedCompanyId,
  });
  if (!template) {
    console.error(
      "[companyTemplatePreferenceStore] setPreferredSetup: template not found for company",
      { companyId: scopedCompanyId, templateId: scopedTemplateId }
    );
    return null;
  }
  if (!isTemplateEligibleForPreferredSetup(template)) {
    console.error(
      "[companyTemplatePreferenceStore] setPreferredSetup: template not eligible (archived or inactive)",
      {
        companyId: scopedCompanyId,
        templateId: scopedTemplateId,
        status: template.status,
        active: template.active,
      }
    );
    return null;
  }

  const { moduleKey, workflowKey, preferenceKind } = resolveScope(scope);

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          company_id: scopedCompanyId,
          module_key: moduleKey,
          workflow_key: workflowKey,
          preference_kind: preferenceKind,
          template_id: scopedTemplateId,
        },
        { onConflict: "company_id,module_key,workflow_key,preference_kind" }
      )
      .select(COMPANY_TEMPLATE_PREFERENCE_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[companyTemplatePreferenceStore] setPreferredSetup failed:", error.message, {
        companyId: scopedCompanyId,
        templateId: scopedTemplateId,
        moduleKey,
        workflowKey,
        preferenceKind,
      });
      return null;
    }
    if (!data) return null;
    return rowToPreference(data as CompanyTemplatePreferenceRow);
  } catch (err) {
    console.error("[companyTemplatePreferenceStore] setPreferredSetup error:", err);
    return null;
  }
}

export async function clearPreferredSetup(
  companyId: string,
  scope?: CompanyTemplatePreferenceScope
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[companyTemplatePreferenceStore] clearPreferredSetup: Supabase client unavailable"
    );
    return false;
  }

  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error("[companyTemplatePreferenceStore] clearPreferredSetup: invalid company id");
    return false;
  }

  const { moduleKey, workflowKey, preferenceKind } = resolveScope(scope);

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("company_id", scopedCompanyId)
      .eq("module_key", moduleKey)
      .eq("workflow_key", workflowKey)
      .eq("preference_kind", preferenceKind);

    if (error) {
      console.error(
        "[companyTemplatePreferenceStore] clearPreferredSetup failed:",
        error.message,
        { companyId: scopedCompanyId, moduleKey, workflowKey, preferenceKind }
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[companyTemplatePreferenceStore] clearPreferredSetup error:", err);
    return false;
  }
}

/**
 * Clear preferred setup only when the preference currently points at templateId.
 * Used by R2A archive path so archiving a preferred setup drops the preference.
 */
export async function clearPreferredSetupIfTemplate(
  companyId: string,
  templateId: string,
  scope?: CompanyTemplatePreferenceScope
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[companyTemplatePreferenceStore] clearPreferredSetupIfTemplate: Supabase client unavailable"
    );
    return false;
  }

  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error(
      "[companyTemplatePreferenceStore] clearPreferredSetupIfTemplate: invalid company id"
    );
    return false;
  }

  const scopedTemplateId = normalizeUuid(templateId);
  if (!scopedTemplateId) {
    console.error(
      "[companyTemplatePreferenceStore] clearPreferredSetupIfTemplate: invalid template id"
    );
    return false;
  }

  const { moduleKey, workflowKey, preferenceKind } = resolveScope(scope);

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("company_id", scopedCompanyId)
      .eq("module_key", moduleKey)
      .eq("workflow_key", workflowKey)
      .eq("preference_kind", preferenceKind)
      .eq("template_id", scopedTemplateId);

    if (error) {
      console.error(
        "[companyTemplatePreferenceStore] clearPreferredSetupIfTemplate failed:",
        error.message,
        {
          companyId: scopedCompanyId,
          templateId: scopedTemplateId,
          moduleKey,
          workflowKey,
          preferenceKind,
        }
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[companyTemplatePreferenceStore] clearPreferredSetupIfTemplate error:", err);
    return false;
  }
}
