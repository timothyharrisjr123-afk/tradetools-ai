/**
 * S3D8 — server-only draft quantity resolution preflight entry (metadata only).
 *
 * Session-scoped read composition → S3D7 orchestrator via injectable loader.
 * No DB writes. No auto-refresh. No UI. No customer/public DTO exposure.
 */

import "server-only";

import {
  rowToCatalogItem,
  type CatalogItemRow,
} from "@/app/lib/catalogStore";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import { getResolvedCompanyPricingPolicy } from "@/app/lib/companyPricingPolicyStore";
import {
  runDraftQuantityResolutionPreflight,
  type LoadDraftQuantityResolutionPreflightDeps,
  type LoadDraftQuantityResolutionPreflightInput,
} from "@/app/lib/proposalQuantityResolutionPreflightLoad";
import type { DraftQuantityResolutionPreflightOrchestratorResult } from "@/app/lib/proposalQuantityResolutionPreflightOrchestrator";
import { getDraftGraph } from "@/app/lib/proposalRecordStore";
import {
  PROPOSAL_TEMPLATE_ITEM_SELECT_COLUMNS,
  rowToProposalTemplateItem,
  type ProposalTemplateItemRow,
} from "@/app/lib/proposalTemplateStore";
import { createClient } from "@/app/lib/supabase/server";
import type { getSupabaseClient } from "@/app/lib/supabaseClient";

export type {
  LoadDraftQuantityResolutionPreflightInput,
} from "@/app/lib/proposalQuantityResolutionPreflightLoad";
export type {
  DraftQuantityResolutionPreflightOrchestratorResult,
} from "@/app/lib/proposalQuantityResolutionPreflightOrchestrator";

type ServerSupabase = NonNullable<ReturnType<typeof getSupabaseClient>>;

/** Matches catalogStore CATALOG_ITEM_SELECT_COLUMNS (read-only reuse). */
const CATALOG_ITEM_SELECT_COLUMNS =
  "id, company_id, name, customer_name, description, item_type, unit, quantity_source, default_quantity, coverage_rate, coverage_basis, waste_applies, waste_pct, unit_cost_cents, unit_price_cents, labor_unit_cost_cents, pricing_basis, customer_visibility, active, sort_order, metadata, created_by, updated_by, created_at, updated_at";

function buildDraftQuantityResolutionPreflightServerDeps(
  supabase: ServerSupabase
): LoadDraftQuantityResolutionPreflightDeps {
  return {
    getDraftGraph: (companyId, proposalId) =>
      getDraftGraph(companyId, proposalId, { getSupabase: () => supabase }),
    getTemplateItems: async (templateId, companyId) => {
      const tid = templateId.trim();
      const cid = companyId.trim();
      if (!tid || !cid) return null;
      const { data, error } = await supabase
        .from("proposal_template_items")
        .select(PROPOSAL_TEMPLATE_ITEM_SELECT_COLUMNS)
        .eq("template_id", tid)
        .eq("company_id", cid);
      if (error) {
        console.error(
          "[proposalQuantityResolutionPreflight.server] getTemplateItems failed:",
          error.message
        );
        return null;
      }
      return ((data ?? []) as ProposalTemplateItemRow[]).map(
        rowToProposalTemplateItem
      );
    },
    getCatalogItems: async (companyId) => {
      const cid = companyId.trim();
      if (!cid) return [];
      const { data, error } = await supabase
        .from("catalog_items")
        .select(CATALOG_ITEM_SELECT_COLUMNS)
        .eq("company_id", cid)
        .eq("active", true);
      if (error) {
        console.error(
          "[proposalQuantityResolutionPreflight.server] getCatalogItems failed:",
          error.message
        );
        return [];
      }
      return ((data ?? []) as CatalogItemRow[]).map(rowToCatalogItem);
    },
    getSelectedMeasurement: (jobId) =>
      getSelectedMeasurementForJob(jobId, supabase),
    getWasteModel: async (companyId) => {
      const resolution = await getResolvedCompanyPricingPolicy(companyId);
      if (!resolution.configured || resolution.policy == null) return null;
      return resolution.policy.wasteModel;
    },
  };
}

/**
 * Internal server entry: load draft + template + catalog + measurement and
 * return quantity-resolution preflight metadata only.
 */
export async function runDraftQuantityResolutionPreflightForCompany(
  input: LoadDraftQuantityResolutionPreflightInput
): Promise<DraftQuantityResolutionPreflightOrchestratorResult | null> {
  const supabase = await createClient();
  return runDraftQuantityResolutionPreflight(
    input,
    buildDraftQuantityResolutionPreflightServerDeps(supabase as ServerSupabase)
  );
}
