/**
 * FieldDive Proposal Template Store — client-side data layer for proposal template tables.
 *
 * Company-scoped CRUD for reusable proposal templates (options, sections, catalog-backed items).
 * No pricing math, payment, approval, send/PDF, proposal records, Proposal Builder, or UI.
 *
 * Uses getSupabaseClient() with RLS (same pattern as catalogStore / jobStore).
 * Stage 3G3: foundation only — not wired from app routes or RoofingClient yet.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import type { CustomerVisibility } from "@/app/lib/catalogTypes";
import type {
  ProposalTemplate,
  ProposalTemplateDraft,
  ProposalTemplateItem,
  ProposalTemplateItemCustomerVisibility,
  ProposalTemplateItemDraft,
  ProposalTemplateItemRole,
  ProposalTemplateOption,
  ProposalTemplateOptionDraft,
  ProposalTemplateOptionSelectionMode,
  ProposalTemplateSection,
  ProposalTemplateSectionContent,
  ProposalTemplateSectionDraft,
  ProposalTemplateSectionKind,
  ProposalTemplateStatus,
  TemplateQuantityMode,
  TemplateQuantityRule,
} from "@/app/lib/proposalTemplateTypes";
import { TEMPLATE_QUANTITY_MODES } from "@/app/lib/proposalTemplateTypes";

// ---------------------------------------------------------------------------
// Graph (store-only)
// ---------------------------------------------------------------------------

export type ProposalTemplateGraph = {
  template: ProposalTemplate;
  options: ProposalTemplateOption[];
  sections: ProposalTemplateSection[];
  items: ProposalTemplateItem[];
};

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

export type JsonObject = Record<string, unknown>;

export type ProposalTemplateRow = {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  status: string;
  active: boolean;
  sort_order?: number | null;
  metadata: JsonObject;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalTemplateOptionRow = {
  id: string;
  company_id: string;
  template_id: string;
  name: string;
  customer_label?: string | null;
  description?: string | null;
  selection_mode: string;
  is_default: boolean;
  visible_to_customer: boolean;
  sort_order?: number | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type ProposalTemplateSectionRow = {
  id: string;
  company_id: string;
  template_id: string;
  option_id: string;
  kind: string;
  name: string;
  customer_title?: string | null;
  customer_visibility: string;
  sort_order?: number | null;
  content: JsonObject;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type ProposalTemplateItemRow = {
  id: string;
  company_id: string;
  template_id: string;
  option_id: string;
  section_id: string;
  catalog_item_id?: string | null;
  catalog_seed_key?: string | null;
  item_role: string;
  customer_name_override?: string | null;
  description_override?: string | null;
  customer_visibility: string;
  quantity_rule?: JsonObject | null;
  sort_order?: number | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type ProposalTemplateInsertRow = Partial<ProposalTemplateRow>;
export type ProposalTemplateUpdateRow = Partial<ProposalTemplateRow>;
export type ProposalTemplateOptionInsertRow = Partial<ProposalTemplateOptionRow>;
export type ProposalTemplateOptionUpdateRow = Partial<ProposalTemplateOptionRow>;
export type ProposalTemplateSectionInsertRow = Partial<ProposalTemplateSectionRow>;
export type ProposalTemplateSectionUpdateRow = Partial<ProposalTemplateSectionRow>;
export type ProposalTemplateItemInsertRow = Partial<ProposalTemplateItemRow>;
export type ProposalTemplateItemUpdateRow = Partial<ProposalTemplateItemRow>;

export const PROPOSAL_TEMPLATE_SELECT_COLUMNS =
  "id, company_id, name, description, status, active, sort_order, metadata, created_by, updated_by, created_at, updated_at";

export const PROPOSAL_TEMPLATE_OPTION_SELECT_COLUMNS =
  "id, company_id, template_id, name, customer_label, description, selection_mode, is_default, visible_to_customer, sort_order, metadata, created_at, updated_at";

export const PROPOSAL_TEMPLATE_SECTION_SELECT_COLUMNS =
  "id, company_id, template_id, option_id, kind, name, customer_title, customer_visibility, sort_order, content, metadata, created_at, updated_at";

export const PROPOSAL_TEMPLATE_ITEM_SELECT_COLUMNS =
  "id, company_id, template_id, option_id, section_id, catalog_item_id, catalog_seed_key, item_role, customer_name_override, description_override, customer_visibility, quantity_rule, sort_order, metadata, created_at, updated_at";

const TEMPLATE_QUANTITY_MODE_SET = new Set<string>(TEMPLATE_QUANTITY_MODES);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export function normalizeNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function normalizeNullableInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return fallback;
}

export function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

export function compactObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

export function normalizeJsonObject(value: unknown): JsonObject | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
}

function normalizeCompanyId(companyId: string): string | null {
  const id = normalizeNullableString(companyId);
  if (!id || !isUuidLike(id)) return null;
  return id;
}

function normalizeUuidParam(id: string, label: string): string | null {
  const trimmed = String(id || "").trim();
  if (!isUuidLike(trimmed)) {
    console.error(`[proposalTemplateStore] ${label}: invalid uuid`);
    return null;
  }
  return trimmed;
}

function normalizeSectionContent(value: unknown): ProposalTemplateSectionContent | null {
  const obj = normalizeJsonObject(value);
  if (!obj) return null;
  return {
    title: normalizeNullableString(obj.title),
    body_markdown: normalizeNullableString(obj.body_markdown),
    layout_hint: normalizeNullableString(obj.layout_hint),
    asset_ref: normalizeNullableString(obj.asset_ref),
  };
}

function normalizeTemplateQuantityRule(value: unknown): TemplateQuantityRule | null {
  const obj = normalizeJsonObject(value);
  if (!obj) return null;
  const mode = obj.mode;
  if (typeof mode !== "string" || !TEMPLATE_QUANTITY_MODE_SET.has(mode)) {
    return null;
  }
  const rule: TemplateQuantityRule = {
    mode: mode as TemplateQuantityMode,
  };
  if (obj.quantity_source !== undefined && obj.quantity_source !== null) {
    rule.quantity_source = String(obj.quantity_source) as TemplateQuantityRule["quantity_source"];
  }
  if (obj.measurement_quantity_key !== undefined) {
    rule.measurement_quantity_key = normalizeNullableString(obj.measurement_quantity_key);
  }
  if (obj.fixed_quantity !== undefined) {
    rule.fixed_quantity = normalizeNullableNumber(obj.fixed_quantity);
  }
  if (obj.quantity_multiplier !== undefined) {
    rule.quantity_multiplier = normalizeNullableNumber(obj.quantity_multiplier);
  }
  if (obj.waste_factor_override !== undefined) {
    rule.waste_factor_override = normalizeNullableNumber(obj.waste_factor_override);
  }
  if (obj.allow_manual_override !== undefined) {
    rule.allow_manual_override = normalizeBoolean(obj.allow_manual_override, false);
  }
  return rule;
}

function hasCatalogReference(
  catalogItemId: string | null | undefined,
  catalogSeedKey: string | null | undefined
): boolean {
  if (catalogItemId && isUuidLike(catalogItemId)) return true;
  const seed = normalizeNullableString(catalogSeedKey);
  return seed != null;
}

function stripImmutableTemplateFields(row: ProposalTemplateUpdateRow): void {
  delete row.id;
  delete row.company_id;
  delete row.created_at;
  delete row.updated_at;
  delete row.created_by;
  delete row.updated_by;
}

function stripImmutableOptionFields(row: ProposalTemplateOptionUpdateRow): void {
  delete row.id;
  delete row.company_id;
  delete row.template_id;
  delete row.created_at;
  delete row.updated_at;
}

function stripImmutableSectionFields(row: ProposalTemplateSectionUpdateRow): void {
  delete row.id;
  delete row.company_id;
  delete row.template_id;
  delete row.option_id;
  delete row.created_at;
  delete row.updated_at;
}

function stripImmutableItemFields(row: ProposalTemplateItemUpdateRow): void {
  delete row.id;
  delete row.company_id;
  delete row.template_id;
  delete row.option_id;
  delete row.section_id;
  delete row.created_at;
  delete row.updated_at;
}

// ---------------------------------------------------------------------------
// Row ↔ domain mappers
// ---------------------------------------------------------------------------

export function rowToProposalTemplate(row: ProposalTemplateRow): ProposalTemplate {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    description: normalizeNullableString(row.description),
    status: row.status as ProposalTemplateStatus,
    active: Boolean(row.active),
    sort_order: normalizeNullableInteger(row.sort_order),
    metadata: normalizeJsonObject(row.metadata) ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
  };
}

export function rowToProposalTemplateOption(
  row: ProposalTemplateOptionRow
): ProposalTemplateOption {
  return {
    id: row.id,
    template_id: row.template_id,
    name: row.name,
    customer_label: normalizeNullableString(row.customer_label),
    description: normalizeNullableString(row.description),
    selection_mode: row.selection_mode as ProposalTemplateOptionSelectionMode,
    is_default: Boolean(row.is_default),
    visible_to_customer: Boolean(row.visible_to_customer),
    sort_order: normalizeNullableInteger(row.sort_order),
    metadata: normalizeJsonObject(row.metadata) ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToProposalTemplateSection(
  row: ProposalTemplateSectionRow
): ProposalTemplateSection {
  const content = normalizeSectionContent(row.content);
  return {
    id: row.id,
    template_id: row.template_id,
    option_id: row.option_id,
    kind: row.kind as ProposalTemplateSectionKind,
    name: row.name,
    customer_title: normalizeNullableString(row.customer_title),
    customer_visibility: row.customer_visibility as CustomerVisibility,
    sort_order: normalizeNullableInteger(row.sort_order),
    content: content ?? {},
    metadata: normalizeJsonObject(row.metadata) ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToProposalTemplateItem(row: ProposalTemplateItemRow): ProposalTemplateItem {
  return {
    id: row.id,
    template_id: row.template_id,
    option_id: row.option_id,
    section_id: row.section_id,
    catalog_item_id: row.catalog_item_id && isUuidLike(row.catalog_item_id) ? row.catalog_item_id : null,
    catalog_seed_key: normalizeNullableString(row.catalog_seed_key),
    item_role: row.item_role as ProposalTemplateItemRole,
    customer_name_override: normalizeNullableString(row.customer_name_override),
    description_override: normalizeNullableString(row.description_override),
    customer_visibility:
      row.customer_visibility as ProposalTemplateItemCustomerVisibility,
    quantity_rule: normalizeTemplateQuantityRule(row.quantity_rule),
    sort_order: normalizeNullableInteger(row.sort_order),
    metadata: normalizeJsonObject(row.metadata) ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function proposalTemplateDraftToRowFields(
  draft: ProposalTemplateDraft | Partial<ProposalTemplateDraft>,
  mode: "insert" | "update"
): ProposalTemplateInsertRow {
  const row: ProposalTemplateInsertRow = {
    company_id: mode === "insert" ? draft.company_id : undefined,
    name:
      draft.name !== undefined ? normalizeNullableString(draft.name) ?? undefined : undefined,
    description:
      draft.description !== undefined
        ? normalizeNullableString(draft.description)
        : undefined,
    status: draft.status ?? (mode === "insert" ? "draft" : undefined),
    active: draft.active !== undefined ? Boolean(draft.active) : mode === "insert" ? true : undefined,
    sort_order:
      draft.sort_order !== undefined
        ? normalizeNullableInteger(draft.sort_order)
        : undefined,
    metadata:
      draft.metadata !== undefined ? (normalizeJsonObject(draft.metadata) ?? {}) : undefined,
  };
  return compactObject(row as Record<string, unknown>) as ProposalTemplateInsertRow;
}

export function proposalTemplateDraftToInsertRow(
  draft: ProposalTemplateDraft
): ProposalTemplateInsertRow {
  return proposalTemplateDraftToRowFields(draft, "insert");
}

export function proposalTemplatePatchToUpdateRow(
  patch: Partial<ProposalTemplateDraft>
): ProposalTemplateUpdateRow {
  return proposalTemplateDraftToRowFields(patch, "update");
}

function proposalTemplateOptionDraftToRowFields(
  draft: ProposalTemplateOptionDraft | Partial<ProposalTemplateOptionDraft>,
  mode: "insert" | "update",
  scope: { companyId: string; templateId: string }
): ProposalTemplateOptionInsertRow {
  const row: ProposalTemplateOptionInsertRow = {
    company_id: mode === "insert" ? scope.companyId : undefined,
    template_id: mode === "insert" ? scope.templateId : undefined,
    name:
      draft.name !== undefined ? normalizeNullableString(draft.name) ?? undefined : undefined,
    customer_label:
      draft.customer_label !== undefined
        ? normalizeNullableString(draft.customer_label)
        : undefined,
    description:
      draft.description !== undefined
        ? normalizeNullableString(draft.description)
        : undefined,
    selection_mode:
      draft.selection_mode ?? (mode === "insert" ? "included" : undefined),
    is_default:
      draft.is_default !== undefined
        ? Boolean(draft.is_default)
        : mode === "insert"
          ? false
          : undefined,
    visible_to_customer:
      draft.visible_to_customer !== undefined
        ? Boolean(draft.visible_to_customer)
        : mode === "insert"
          ? true
          : undefined,
    sort_order:
      draft.sort_order !== undefined
        ? normalizeNullableInteger(draft.sort_order)
        : undefined,
    metadata:
      draft.metadata !== undefined ? (normalizeJsonObject(draft.metadata) ?? {}) : undefined,
  };
  return compactObject(row as Record<string, unknown>) as ProposalTemplateOptionInsertRow;
}

export function proposalTemplateOptionDraftToInsertRow(
  draft: ProposalTemplateOptionDraft,
  scope: { companyId: string; templateId: string }
): ProposalTemplateOptionInsertRow {
  return proposalTemplateOptionDraftToRowFields(draft, "insert", scope);
}

export function proposalTemplateOptionPatchToUpdateRow(
  patch: Partial<ProposalTemplateOptionDraft>
): ProposalTemplateOptionUpdateRow {
  return proposalTemplateOptionDraftToRowFields(
    patch,
    "update",
    { companyId: "", templateId: "" }
  );
}

function proposalTemplateSectionDraftToRowFields(
  draft: ProposalTemplateSectionDraft | Partial<ProposalTemplateSectionDraft>,
  mode: "insert" | "update",
  scope: { companyId: string; templateId: string; optionId: string }
): ProposalTemplateSectionInsertRow {
  const contentValue =
    draft.content !== undefined
      ? (normalizeSectionContent(draft.content) ?? {})
      : undefined;

  const row: ProposalTemplateSectionInsertRow = {
    company_id: mode === "insert" ? scope.companyId : undefined,
    template_id: mode === "insert" ? scope.templateId : undefined,
    option_id: mode === "insert" ? scope.optionId : undefined,
    kind: draft.kind,
    name:
      draft.name !== undefined ? normalizeNullableString(draft.name) ?? undefined : undefined,
    customer_title:
      draft.customer_title !== undefined
        ? normalizeNullableString(draft.customer_title)
        : undefined,
    customer_visibility:
      draft.customer_visibility ?? (mode === "insert" ? "customer_visible" : undefined),
    sort_order:
      draft.sort_order !== undefined
        ? normalizeNullableInteger(draft.sort_order)
        : undefined,
    content: mode === "insert" ? (contentValue ?? {}) : contentValue,
    metadata:
      draft.metadata !== undefined ? (normalizeJsonObject(draft.metadata) ?? {}) : undefined,
  };
  return compactObject(row as Record<string, unknown>) as ProposalTemplateSectionInsertRow;
}

export function proposalTemplateSectionDraftToInsertRow(
  draft: ProposalTemplateSectionDraft,
  scope: { companyId: string; templateId: string; optionId: string }
): ProposalTemplateSectionInsertRow {
  return proposalTemplateSectionDraftToRowFields(draft, "insert", scope);
}

export function proposalTemplateSectionPatchToUpdateRow(
  patch: Partial<ProposalTemplateSectionDraft>
): ProposalTemplateSectionUpdateRow {
  return proposalTemplateSectionDraftToRowFields(
    patch,
    "update",
    { companyId: "", templateId: "", optionId: "" }
  );
}

function proposalTemplateItemDraftToRowFields(
  draft: ProposalTemplateItemDraft | Partial<ProposalTemplateItemDraft>,
  mode: "insert" | "update",
  scope: { companyId: string; templateId: string; optionId: string; sectionId: string }
): ProposalTemplateItemInsertRow {
  const quantityRuleValue =
    draft.quantity_rule !== undefined
      ? draft.quantity_rule === null
        ? null
        : normalizeTemplateQuantityRule(draft.quantity_rule)
      : undefined;

  const row: ProposalTemplateItemInsertRow = {
    company_id: mode === "insert" ? scope.companyId : undefined,
    template_id: mode === "insert" ? scope.templateId : undefined,
    option_id: mode === "insert" ? scope.optionId : undefined,
    section_id: mode === "insert" ? scope.sectionId : undefined,
    catalog_item_id:
      draft.catalog_item_id !== undefined
        ? draft.catalog_item_id && isUuidLike(draft.catalog_item_id)
          ? draft.catalog_item_id
          : null
        : undefined,
    catalog_seed_key:
      draft.catalog_seed_key !== undefined
        ? normalizeNullableString(draft.catalog_seed_key)
        : undefined,
    item_role: draft.item_role ?? (mode === "insert" ? "standard" : undefined),
    customer_name_override:
      draft.customer_name_override !== undefined
        ? normalizeNullableString(draft.customer_name_override)
        : undefined,
    description_override:
      draft.description_override !== undefined
        ? normalizeNullableString(draft.description_override)
        : undefined,
    customer_visibility:
      draft.customer_visibility ?? (mode === "insert" ? "inherit_catalog" : undefined),
    quantity_rule: draft.quantity_rule !== undefined ? quantityRuleValue : undefined,
    sort_order:
      draft.sort_order !== undefined
        ? normalizeNullableInteger(draft.sort_order)
        : undefined,
    metadata:
      draft.metadata !== undefined ? (normalizeJsonObject(draft.metadata) ?? {}) : undefined,
  };
  return compactObject(row as Record<string, unknown>) as ProposalTemplateItemInsertRow;
}

export function proposalTemplateItemDraftToInsertRow(
  draft: ProposalTemplateItemDraft,
  scope: { companyId: string; templateId: string; optionId: string; sectionId: string }
): ProposalTemplateItemInsertRow {
  return proposalTemplateItemDraftToRowFields(draft, "insert", scope);
}

export function proposalTemplateItemPatchToUpdateRow(
  patch: Partial<ProposalTemplateItemDraft>
): ProposalTemplateItemUpdateRow {
  return proposalTemplateItemDraftToRowFields(
    patch,
    "update",
    { companyId: "", templateId: "", optionId: "", sectionId: "" }
  );
}

// ---------------------------------------------------------------------------
// List ordering
// ---------------------------------------------------------------------------

function applyTemplateListOrder<
  Q extends {
    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean }
    ) => Q;
  },
>(query: Q): Q {
  return query
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
}

function applyOptionListOrder<
  Q extends {
    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean }
    ) => Q;
  },
>(query: Q): Q {
  return query
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
}

function applySectionListOrder<
  Q extends {
    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean }
    ) => Q;
  },
>(query: Q): Q {
  return query
    .order("option_id", { ascending: true })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
}

function applyItemListOrder<
  Q extends {
    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean }
    ) => Q;
  },
>(query: Q): Q {
  return query
    .order("section_id", { ascending: true })
    .order("sort_order", { ascending: true, nullsFirst: false });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getProposalTemplateById(
  id: string,
  options: { companyId: string }
): Promise<ProposalTemplate | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[proposalTemplateStore] getProposalTemplateById: Supabase client unavailable");
    return null;
  }

  const templateId = normalizeUuidParam(id, "getProposalTemplateById");
  if (!templateId) return null;

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] getProposalTemplateById: invalid company id");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("proposal_templates")
      .select(PROPOSAL_TEMPLATE_SELECT_COLUMNS)
      .eq("id", templateId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      console.error("[proposalTemplateStore] getProposalTemplateById failed:", error.message, {
        id: templateId,
        companyId,
      });
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplate(data as ProposalTemplateRow);
  } catch (err) {
    console.error("[proposalTemplateStore] getProposalTemplateById error:", err);
    return null;
  }
}

export async function getProposalTemplatesByCompany(
  companyId: string,
  options?: { activeOnly?: boolean; status?: ProposalTemplateStatus | null }
): Promise<ProposalTemplate[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] getProposalTemplatesByCompany: Supabase client unavailable"
    );
    return [];
  }

  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error("[proposalTemplateStore] getProposalTemplatesByCompany: invalid company id");
    return [];
  }

  try {
    let query = supabase
      .from("proposal_templates")
      .select(PROPOSAL_TEMPLATE_SELECT_COLUMNS)
      .eq("company_id", scopedCompanyId);

    if (options?.activeOnly) {
      query = query.eq("active", true);
    }
    if (options?.status) {
      query = query.eq("status", options.status);
    }

    query = applyTemplateListOrder(query);

    const { data, error } = await query;

    if (error) {
      console.error(
        "[proposalTemplateStore] getProposalTemplatesByCompany failed:",
        error.message,
        { companyId: scopedCompanyId }
      );
      return [];
    }

    const rows = (data ?? []) as ProposalTemplateRow[];
    return rows.map(rowToProposalTemplate);
  } catch (err) {
    console.error("[proposalTemplateStore] getProposalTemplatesByCompany error:", err);
    return [];
  }
}

export async function getActiveProposalTemplatesByCompany(
  companyId: string
): Promise<ProposalTemplate[]> {
  return getProposalTemplatesByCompany(companyId, { activeOnly: true });
}

export async function getProposalTemplateOptions(
  templateId: string,
  options: { companyId: string }
): Promise<ProposalTemplateOption[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] getProposalTemplateOptions: Supabase client unavailable"
    );
    return [];
  }

  const scopedTemplateId = normalizeUuidParam(templateId, "getProposalTemplateOptions");
  if (!scopedTemplateId) return [];

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] getProposalTemplateOptions: invalid company id");
    return [];
  }

  try {
    const query = applyOptionListOrder(
      supabase
        .from("proposal_template_options")
        .select(PROPOSAL_TEMPLATE_OPTION_SELECT_COLUMNS)
        .eq("template_id", scopedTemplateId)
        .eq("company_id", companyId)
    );

    const { data, error } = await query;

    if (error) {
      console.error("[proposalTemplateStore] getProposalTemplateOptions failed:", error.message, {
        templateId: scopedTemplateId,
        companyId,
      });
      return [];
    }

    return ((data ?? []) as ProposalTemplateOptionRow[]).map(rowToProposalTemplateOption);
  } catch (err) {
    console.error("[proposalTemplateStore] getProposalTemplateOptions error:", err);
    return [];
  }
}

export async function getProposalTemplateSections(
  templateId: string,
  options: { companyId: string }
): Promise<ProposalTemplateSection[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] getProposalTemplateSections: Supabase client unavailable"
    );
    return [];
  }

  const scopedTemplateId = normalizeUuidParam(templateId, "getProposalTemplateSections");
  if (!scopedTemplateId) return [];

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] getProposalTemplateSections: invalid company id");
    return [];
  }

  try {
    const query = applySectionListOrder(
      supabase
        .from("proposal_template_sections")
        .select(PROPOSAL_TEMPLATE_SECTION_SELECT_COLUMNS)
        .eq("template_id", scopedTemplateId)
        .eq("company_id", companyId)
    );

    const { data, error } = await query;

    if (error) {
      console.error(
        "[proposalTemplateStore] getProposalTemplateSections failed:",
        error.message,
        { templateId: scopedTemplateId, companyId }
      );
      return [];
    }

    return ((data ?? []) as ProposalTemplateSectionRow[]).map(rowToProposalTemplateSection);
  } catch (err) {
    console.error("[proposalTemplateStore] getProposalTemplateSections error:", err);
    return [];
  }
}

export async function getProposalTemplateItems(
  templateId: string,
  options: { companyId: string }
): Promise<ProposalTemplateItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] getProposalTemplateItems: Supabase client unavailable"
    );
    return [];
  }

  const scopedTemplateId = normalizeUuidParam(templateId, "getProposalTemplateItems");
  if (!scopedTemplateId) return [];

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] getProposalTemplateItems: invalid company id");
    return [];
  }

  try {
    const query = applyItemListOrder(
      supabase
        .from("proposal_template_items")
        .select(PROPOSAL_TEMPLATE_ITEM_SELECT_COLUMNS)
        .eq("template_id", scopedTemplateId)
        .eq("company_id", companyId)
    );

    const { data, error } = await query;

    if (error) {
      console.error("[proposalTemplateStore] getProposalTemplateItems failed:", error.message, {
        templateId: scopedTemplateId,
        companyId,
      });
      return [];
    }

    return ((data ?? []) as ProposalTemplateItemRow[]).map(rowToProposalTemplateItem);
  } catch (err) {
    console.error("[proposalTemplateStore] getProposalTemplateItems error:", err);
    return [];
  }
}

export async function getProposalTemplateItemsBySection(
  sectionId: string,
  options: { companyId: string }
): Promise<ProposalTemplateItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] getProposalTemplateItemsBySection: Supabase client unavailable"
    );
    return [];
  }

  const scopedSectionId = normalizeUuidParam(sectionId, "getProposalTemplateItemsBySection");
  if (!scopedSectionId) return [];

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error(
      "[proposalTemplateStore] getProposalTemplateItemsBySection: invalid company id"
    );
    return [];
  }

  try {
    const query = applyItemListOrder(
      supabase
        .from("proposal_template_items")
        .select(PROPOSAL_TEMPLATE_ITEM_SELECT_COLUMNS)
        .eq("section_id", scopedSectionId)
        .eq("company_id", companyId)
    );

    const { data, error } = await query;

    if (error) {
      console.error(
        "[proposalTemplateStore] getProposalTemplateItemsBySection failed:",
        error.message,
        { sectionId: scopedSectionId, companyId }
      );
      return [];
    }

    return ((data ?? []) as ProposalTemplateItemRow[]).map(rowToProposalTemplateItem);
  } catch (err) {
    console.error("[proposalTemplateStore] getProposalTemplateItemsBySection error:", err);
    return [];
  }
}

export async function getProposalTemplateGraph(
  templateId: string,
  options: { companyId: string }
): Promise<ProposalTemplateGraph | null> {
  const template = await getProposalTemplateById(templateId, options);
  if (!template) return null;

  const scopedTemplateId = template.id;
  const companyId = options.companyId;

  try {
    const [optionRows, sectionRows, itemRows] = await Promise.all([
      getProposalTemplateOptions(scopedTemplateId, { companyId }),
      getProposalTemplateSections(scopedTemplateId, { companyId }),
      getProposalTemplateItems(scopedTemplateId, { companyId }),
    ]);

    return {
      template,
      options: optionRows,
      sections: sectionRows,
      items: itemRows,
    };
  } catch (err) {
    console.error("[proposalTemplateStore] getProposalTemplateGraph error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Writes — template
// ---------------------------------------------------------------------------

export async function createProposalTemplate(
  draft: ProposalTemplateDraft
): Promise<ProposalTemplate | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[proposalTemplateStore] createProposalTemplate: Supabase client unavailable");
    return null;
  }

  const companyId = normalizeCompanyId(draft.company_id);
  if (!companyId) {
    console.error("[proposalTemplateStore] createProposalTemplate: company_id is required");
    return null;
  }

  const name = normalizeNullableString(draft.name);
  if (!name) {
    console.error("[proposalTemplateStore] createProposalTemplate: name is required");
    return null;
  }

  const row = proposalTemplateDraftToInsertRow({
    ...draft,
    company_id: companyId,
    name,
  });

  try {
    const { data, error } = await supabase
      .from("proposal_templates")
      .insert(row)
      .select(PROPOSAL_TEMPLATE_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[proposalTemplateStore] createProposalTemplate failed:", error.message, {
        companyId,
      });
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplate(data as ProposalTemplateRow);
  } catch (err) {
    console.error("[proposalTemplateStore] createProposalTemplate error:", err);
    return null;
  }
}

export async function updateProposalTemplate(
  id: string,
  patch: Partial<ProposalTemplateDraft>,
  options: { companyId: string }
): Promise<ProposalTemplate | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[proposalTemplateStore] updateProposalTemplate: Supabase client unavailable");
    return null;
  }

  const templateId = normalizeUuidParam(id, "updateProposalTemplate");
  if (!templateId) return null;

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] updateProposalTemplate: invalid company id");
    return null;
  }

  const row = proposalTemplatePatchToUpdateRow(patch);
  stripImmutableTemplateFields(row);

  if (Object.keys(row).length === 0) {
    return getProposalTemplateById(templateId, { companyId });
  }

  try {
    const { data, error } = await supabase
      .from("proposal_templates")
      .update(row)
      .eq("id", templateId)
      .eq("company_id", companyId)
      .select(PROPOSAL_TEMPLATE_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[proposalTemplateStore] updateProposalTemplate failed:", error.message, {
        id: templateId,
        companyId,
      });
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplate(data as ProposalTemplateRow);
  } catch (err) {
    console.error("[proposalTemplateStore] updateProposalTemplate error:", err);
    return null;
  }
}

export async function setProposalTemplateActive(
  id: string,
  active: boolean,
  options: { companyId: string }
): Promise<ProposalTemplate | null> {
  return updateProposalTemplate(id, { active: Boolean(active) }, options);
}

export async function updateProposalTemplateStatus(
  id: string,
  status: ProposalTemplateStatus,
  options: { companyId: string }
): Promise<ProposalTemplate | null> {
  return updateProposalTemplate(id, { status }, options);
}

// ---------------------------------------------------------------------------
// Writes — options
// ---------------------------------------------------------------------------

export async function createProposalTemplateOption(
  draft: ProposalTemplateOptionDraft,
  options: { companyId: string; templateId: string }
): Promise<ProposalTemplateOption | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] createProposalTemplateOption: Supabase client unavailable"
    );
    return null;
  }

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] createProposalTemplateOption: invalid company id");
    return null;
  }

  const templateId = normalizeUuidParam(options.templateId, "createProposalTemplateOption");
  if (!templateId) return null;

  const name = normalizeNullableString(draft.name);
  if (!name) {
    console.error("[proposalTemplateStore] createProposalTemplateOption: name is required");
    return null;
  }

  const template = await getProposalTemplateById(templateId, { companyId });
  if (!template) {
    console.error(
      "[proposalTemplateStore] createProposalTemplateOption: template not found for company"
    );
    return null;
  }

  const row = proposalTemplateOptionDraftToInsertRow(
    { ...draft, name, template_id: templateId },
    { companyId, templateId }
  );

  try {
    const { data, error } = await supabase
      .from("proposal_template_options")
      .insert(row)
      .select(PROPOSAL_TEMPLATE_OPTION_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error(
        "[proposalTemplateStore] createProposalTemplateOption failed:",
        error.message,
        { companyId, templateId }
      );
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplateOption(data as ProposalTemplateOptionRow);
  } catch (err) {
    console.error("[proposalTemplateStore] createProposalTemplateOption error:", err);
    return null;
  }
}

export async function updateProposalTemplateOption(
  id: string,
  patch: Partial<ProposalTemplateOptionDraft>,
  options: { companyId: string; templateId?: string }
): Promise<ProposalTemplateOption | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] updateProposalTemplateOption: Supabase client unavailable"
    );
    return null;
  }

  const optionId = normalizeUuidParam(id, "updateProposalTemplateOption");
  if (!optionId) return null;

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] updateProposalTemplateOption: invalid company id");
    return null;
  }

  const row = proposalTemplateOptionPatchToUpdateRow(patch);
  stripImmutableOptionFields(row);

  if (Object.keys(row).length === 0) {
    return fetchOptionById(supabase, optionId, companyId, options.templateId);
  }

  try {
    let query = supabase
      .from("proposal_template_options")
      .update(row)
      .eq("id", optionId)
      .eq("company_id", companyId);

    if (options.templateId) {
      const templateId = normalizeUuidParam(
        options.templateId,
        "updateProposalTemplateOption"
      );
      if (!templateId) return null;
      query = query.eq("template_id", templateId);
    }

    const { data, error } = await query
      .select(PROPOSAL_TEMPLATE_OPTION_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error(
        "[proposalTemplateStore] updateProposalTemplateOption failed:",
        error.message,
        { id: optionId, companyId }
      );
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplateOption(data as ProposalTemplateOptionRow);
  } catch (err) {
    console.error("[proposalTemplateStore] updateProposalTemplateOption error:", err);
    return null;
  }
}

async function fetchOptionById(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  optionId: string,
  companyId: string,
  templateId?: string
): Promise<ProposalTemplateOption | null> {
  let query = supabase
    .from("proposal_template_options")
    .select(PROPOSAL_TEMPLATE_OPTION_SELECT_COLUMNS)
    .eq("id", optionId)
    .eq("company_id", companyId);

  if (templateId) {
    const scopedTemplateId = normalizeUuidParam(templateId, "fetchOptionById");
    if (!scopedTemplateId) return null;
    query = query.eq("template_id", scopedTemplateId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return rowToProposalTemplateOption(data as ProposalTemplateOptionRow);
}

// ---------------------------------------------------------------------------
// Writes — sections
// ---------------------------------------------------------------------------

export async function createProposalTemplateSection(
  draft: ProposalTemplateSectionDraft,
  options: { companyId: string; templateId: string; optionId: string }
): Promise<ProposalTemplateSection | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] createProposalTemplateSection: Supabase client unavailable"
    );
    return null;
  }

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] createProposalTemplateSection: invalid company id");
    return null;
  }

  const templateId = normalizeUuidParam(options.templateId, "createProposalTemplateSection");
  if (!templateId) return null;

  const optionId = normalizeUuidParam(options.optionId, "createProposalTemplateSection");
  if (!optionId) return null;

  const name = normalizeNullableString(draft.name);
  if (!name) {
    console.error("[proposalTemplateStore] createProposalTemplateSection: name is required");
    return null;
  }

  if (!draft.kind) {
    console.error("[proposalTemplateStore] createProposalTemplateSection: kind is required");
    return null;
  }

  const template = await getProposalTemplateById(templateId, { companyId });
  if (!template) {
    console.error(
      "[proposalTemplateStore] createProposalTemplateSection: template not found for company"
    );
    return null;
  }

  const row = proposalTemplateSectionDraftToInsertRow(
    {
      ...draft,
      name,
      template_id: templateId,
      option_id: optionId,
    },
    { companyId, templateId, optionId }
  );

  try {
    const { data, error } = await supabase
      .from("proposal_template_sections")
      .insert(row)
      .select(PROPOSAL_TEMPLATE_SECTION_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error(
        "[proposalTemplateStore] createProposalTemplateSection failed:",
        error.message,
        { companyId, templateId, optionId }
      );
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplateSection(data as ProposalTemplateSectionRow);
  } catch (err) {
    console.error("[proposalTemplateStore] createProposalTemplateSection error:", err);
    return null;
  }
}

export async function updateProposalTemplateSection(
  id: string,
  patch: Partial<ProposalTemplateSectionDraft>,
  options: { companyId: string; templateId?: string; optionId?: string }
): Promise<ProposalTemplateSection | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] updateProposalTemplateSection: Supabase client unavailable"
    );
    return null;
  }

  const sectionId = normalizeUuidParam(id, "updateProposalTemplateSection");
  if (!sectionId) return null;

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] updateProposalTemplateSection: invalid company id");
    return null;
  }

  const row = proposalTemplateSectionPatchToUpdateRow(patch);
  stripImmutableSectionFields(row);

  if (Object.keys(row).length === 0) {
    return fetchSectionById(supabase, sectionId, companyId, options);
  }

  try {
    let query = supabase
      .from("proposal_template_sections")
      .update(row)
      .eq("id", sectionId)
      .eq("company_id", companyId);

    if (options.templateId) {
      const templateId = normalizeUuidParam(
        options.templateId,
        "updateProposalTemplateSection"
      );
      if (!templateId) return null;
      query = query.eq("template_id", templateId);
    }
    if (options.optionId) {
      const optionId = normalizeUuidParam(options.optionId, "updateProposalTemplateSection");
      if (!optionId) return null;
      query = query.eq("option_id", optionId);
    }

    const { data, error } = await query
      .select(PROPOSAL_TEMPLATE_SECTION_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error(
        "[proposalTemplateStore] updateProposalTemplateSection failed:",
        error.message,
        { id: sectionId, companyId }
      );
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplateSection(data as ProposalTemplateSectionRow);
  } catch (err) {
    console.error("[proposalTemplateStore] updateProposalTemplateSection error:", err);
    return null;
  }
}

async function fetchSectionById(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  sectionId: string,
  companyId: string,
  scope?: { templateId?: string; optionId?: string }
): Promise<ProposalTemplateSection | null> {
  let query = supabase
    .from("proposal_template_sections")
    .select(PROPOSAL_TEMPLATE_SECTION_SELECT_COLUMNS)
    .eq("id", sectionId)
    .eq("company_id", companyId);

  if (scope?.templateId) {
    const templateId = normalizeUuidParam(scope.templateId, "fetchSectionById");
    if (!templateId) return null;
    query = query.eq("template_id", templateId);
  }
  if (scope?.optionId) {
    const optionId = normalizeUuidParam(scope.optionId, "fetchSectionById");
    if (!optionId) return null;
    query = query.eq("option_id", optionId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return rowToProposalTemplateSection(data as ProposalTemplateSectionRow);
}

// ---------------------------------------------------------------------------
// Writes — items
// ---------------------------------------------------------------------------

export async function createProposalTemplateItem(
  draft: ProposalTemplateItemDraft,
  options: { companyId: string; templateId: string; optionId: string; sectionId: string }
): Promise<ProposalTemplateItem | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] createProposalTemplateItem: Supabase client unavailable"
    );
    return null;
  }

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] createProposalTemplateItem: invalid company id");
    return null;
  }

  const templateId = normalizeUuidParam(options.templateId, "createProposalTemplateItem");
  if (!templateId) return null;

  const optionId = normalizeUuidParam(options.optionId, "createProposalTemplateItem");
  if (!optionId) return null;

  const sectionId = normalizeUuidParam(options.sectionId, "createProposalTemplateItem");
  if (!sectionId) return null;

  if (!draft.item_role) {
    console.error("[proposalTemplateStore] createProposalTemplateItem: item_role is required");
    return null;
  }

  const catalogItemId =
    draft.catalog_item_id !== undefined && draft.catalog_item_id !== null
      ? isUuidLike(draft.catalog_item_id)
        ? draft.catalog_item_id
        : null
      : null;
  const catalogSeedKey =
    draft.catalog_seed_key !== undefined
      ? normalizeNullableString(draft.catalog_seed_key)
      : null;

  if (!hasCatalogReference(catalogItemId, catalogSeedKey)) {
    console.error(
      "[proposalTemplateStore] createProposalTemplateItem: catalog_item_id or catalog_seed_key is required"
    );
    return null;
  }

  const template = await getProposalTemplateById(templateId, { companyId });
  if (!template) {
    console.error(
      "[proposalTemplateStore] createProposalTemplateItem: template not found for company"
    );
    return null;
  }

  const row = proposalTemplateItemDraftToInsertRow(
    {
      ...draft,
      template_id: templateId,
      option_id: optionId,
      section_id: sectionId,
      catalog_item_id: catalogItemId,
      catalog_seed_key: catalogSeedKey,
    },
    { companyId, templateId, optionId, sectionId }
  );

  try {
    const { data, error } = await supabase
      .from("proposal_template_items")
      .insert(row)
      .select(PROPOSAL_TEMPLATE_ITEM_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error(
        "[proposalTemplateStore] createProposalTemplateItem failed:",
        error.message,
        { companyId, templateId, sectionId }
      );
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplateItem(data as ProposalTemplateItemRow);
  } catch (err) {
    console.error("[proposalTemplateStore] createProposalTemplateItem error:", err);
    return null;
  }
}

export async function updateProposalTemplateItem(
  id: string,
  patch: Partial<ProposalTemplateItemDraft>,
  options: {
    companyId: string;
    templateId?: string;
    optionId?: string;
    sectionId?: string;
  }
): Promise<ProposalTemplateItem | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[proposalTemplateStore] updateProposalTemplateItem: Supabase client unavailable"
    );
    return null;
  }

  const itemId = normalizeUuidParam(id, "updateProposalTemplateItem");
  if (!itemId) return null;

  const companyId = normalizeCompanyId(options.companyId);
  if (!companyId) {
    console.error("[proposalTemplateStore] updateProposalTemplateItem: invalid company id");
    return null;
  }

  if (
    patch.catalog_item_id !== undefined ||
    patch.catalog_seed_key !== undefined
  ) {
    const nextCatalogId =
      patch.catalog_item_id !== undefined
        ? patch.catalog_item_id && isUuidLike(patch.catalog_item_id)
          ? patch.catalog_item_id
          : null
        : undefined;
    const nextSeedKey =
      patch.catalog_seed_key !== undefined
        ? normalizeNullableString(patch.catalog_seed_key)
        : undefined;

    if (nextCatalogId !== undefined || nextSeedKey !== undefined) {
      const existing = await fetchItemById(supabase, itemId, companyId, options);
      if (!existing) {
        console.error(
          "[proposalTemplateStore] updateProposalTemplateItem: item not found for catalog reference check"
        );
        return null;
      }
      const mergedCatalogId =
        nextCatalogId !== undefined ? nextCatalogId : existing.catalog_item_id ?? null;
      const mergedSeedKey =
        nextSeedKey !== undefined ? nextSeedKey : existing.catalog_seed_key ?? null;
      if (!hasCatalogReference(mergedCatalogId, mergedSeedKey)) {
        console.error(
          "[proposalTemplateStore] updateProposalTemplateItem: catalog_item_id or catalog_seed_key is required"
        );
        return null;
      }
    }
  }

  const row = proposalTemplateItemPatchToUpdateRow(patch);
  stripImmutableItemFields(row);

  if (Object.keys(row).length === 0) {
    return fetchItemById(supabase, itemId, companyId, options);
  }

  try {
    let query = supabase
      .from("proposal_template_items")
      .update(row)
      .eq("id", itemId)
      .eq("company_id", companyId);

    if (options.templateId) {
      const templateId = normalizeUuidParam(options.templateId, "updateProposalTemplateItem");
      if (!templateId) return null;
      query = query.eq("template_id", templateId);
    }
    if (options.optionId) {
      const optionId = normalizeUuidParam(options.optionId, "updateProposalTemplateItem");
      if (!optionId) return null;
      query = query.eq("option_id", optionId);
    }
    if (options.sectionId) {
      const sectionId = normalizeUuidParam(options.sectionId, "updateProposalTemplateItem");
      if (!sectionId) return null;
      query = query.eq("section_id", sectionId);
    }

    const { data, error } = await query
      .select(PROPOSAL_TEMPLATE_ITEM_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error(
        "[proposalTemplateStore] updateProposalTemplateItem failed:",
        error.message,
        { id: itemId, companyId }
      );
      return null;
    }
    if (!data) return null;
    return rowToProposalTemplateItem(data as ProposalTemplateItemRow);
  } catch (err) {
    console.error("[proposalTemplateStore] updateProposalTemplateItem error:", err);
    return null;
  }
}

async function fetchItemById(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  itemId: string,
  companyId: string,
  scope?: { templateId?: string; optionId?: string; sectionId?: string }
): Promise<ProposalTemplateItem | null> {
  let query = supabase
    .from("proposal_template_items")
    .select(PROPOSAL_TEMPLATE_ITEM_SELECT_COLUMNS)
    .eq("id", itemId)
    .eq("company_id", companyId);

  if (scope?.templateId) {
    const templateId = normalizeUuidParam(scope.templateId, "fetchItemById");
    if (!templateId) return null;
    query = query.eq("template_id", templateId);
  }
  if (scope?.optionId) {
    const optionId = normalizeUuidParam(scope.optionId, "fetchItemById");
    if (!optionId) return null;
    query = query.eq("option_id", optionId);
  }
  if (scope?.sectionId) {
    const sectionId = normalizeUuidParam(scope.sectionId, "fetchItemById");
    if (!sectionId) return null;
    query = query.eq("section_id", sectionId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return rowToProposalTemplateItem(data as ProposalTemplateItemRow);
}
