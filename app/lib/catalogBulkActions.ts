/**
 * Catalog bulk actions — definitions + sequential apply via store adapters.
 * No DB access here. Active actions use validated store update paths only.
 */

import { parseTaxRatePctOrNull } from "@/app/admin/catalog/catalogAdminUtils";
import type { CatalogItem, CustomerVisibility } from "@/app/lib/catalogTypes";

export type CatalogBulkActionStatus = "live" | "planned";

/** Immediate live actions — apply without a modal. */
export type CatalogBulkImmediateActionId =
  | "mark_active"
  | "mark_inactive"
  | "proposal_visible"
  | "proposal_hidden";

/** Live actions that open a validation-backed modal before apply. */
export type CatalogBulkModalActionId = "bulk_purchase_tax";

export type CatalogBulkLiveActionId =
  | CatalogBulkImmediateActionId
  | CatalogBulkModalActionId;

export type CatalogBulkPlannedActionId =
  | "bulk_supplier_skus"
  | "assign_supplier"
  | "reorder_selected"
  | "export_selected_csv"
  | "delete_items"
  | "add_to_template"
  | "add_to_proposal_or_order";

export type CatalogBulkActionId = CatalogBulkLiveActionId | CatalogBulkPlannedActionId;

export type CatalogBulkActionDef = {
  id: CatalogBulkActionId;
  label: string;
  detail: string;
  status: CatalogBulkActionStatus;
};

/** Live bulk actions — store-backed, company-scoped. */
export const CATALOG_BULK_LIVE_ACTIONS: readonly CatalogBulkActionDef[] = [
  {
    id: "mark_active",
    label: "Mark active",
    detail: "Reactivate selected catalog items",
    status: "live",
  },
  {
    id: "mark_inactive",
    label: "Mark inactive",
    detail: "Deactivate selected catalog items (soft status)",
    status: "live",
  },
  {
    id: "proposal_visible",
    label: "Show on proposal",
    detail: "Set proposal visibility to Visible",
    status: "live",
  },
  {
    id: "proposal_hidden",
    label: "Hide from proposal",
    detail: "Set proposal visibility to Hidden (internal only)",
    status: "live",
  },
  {
    id: "bulk_purchase_tax",
    label: "Bulk edit purchase tax",
    detail: "Set or clear internal purchase tax on selected items",
    status: "live",
  },
] as const;

/** Planned bulk workflows — visible, disabled, not fake-active. */
export const CATALOG_BULK_PLANNED_ACTIONS: readonly CatalogBulkActionDef[] = [
  {
    id: "bulk_supplier_skus",
    label: "Bulk edit supplier SKUs",
    detail: "Edit ABC / QXO / SRS SKUs on many items — Planned",
    status: "planned",
  },
  {
    id: "assign_supplier",
    label: "Assign supplier",
    detail: "Connect supplier products — Planned",
    status: "planned",
  },
  {
    id: "reorder_selected",
    label: "Reorder selected",
    detail: "Drag or sort selected rows — Planned",
    status: "planned",
  },
  {
    id: "export_selected_csv",
    label: "Export selected CSV",
    detail: "Export only selected rows — Planned",
    status: "planned",
  },
  {
    id: "delete_items",
    label: "Delete items",
    detail: "Hard delete is not available — use Mark inactive",
    status: "planned",
  },
  {
    id: "add_to_template",
    label: "Add to template",
    detail: "Add selected items to a proposal template — Planned",
    status: "planned",
  },
  {
    id: "add_to_proposal_or_order",
    label: "Add to proposal / material order",
    detail: "Proposal import and material ordering — Planned",
    status: "planned",
  },
] as const;

export type CatalogBulkApplyResult = {
  ok: boolean;
  attemptedCount: number;
  successCount: number;
  failedCount: number;
  errors: string[];
};

export type CatalogBulkStoreAdapters = {
  setActive: (
    id: string,
    active: boolean,
    options: { companyId: string }
  ) => Promise<CatalogItem | null>;
  updateVisibility: (
    id: string,
    visibility: CustomerVisibility,
    options: { companyId: string }
  ) => Promise<CatalogItem | null>;
};

export type CatalogBulkPurchaseTaxAdapters = {
  updatePurchaseTax: (
    id: string,
    purchaseTaxRatePct: number | null,
    options: { companyId: string }
  ) => Promise<CatalogItem | null>;
};

export type CatalogBulkPurchaseTaxMode = "set" | "clear";

export function isCatalogBulkImmediateActionId(
  id: CatalogBulkLiveActionId
): id is CatalogBulkImmediateActionId {
  return id !== "bulk_purchase_tax";
}

export function isCatalogBulkModalActionId(
  id: CatalogBulkLiveActionId
): id is CatalogBulkModalActionId {
  return id === "bulk_purchase_tax";
}

function isImmediateActionId(id: string): id is CatalogBulkImmediateActionId {
  return (
    id === "mark_active" ||
    id === "mark_inactive" ||
    id === "proposal_visible" ||
    id === "proposal_hidden"
  );
}

/**
 * Resolve set/clear purchase-tax input using the same strict parser as item tax fields.
 * Blank is only valid for Clear. Set requires 0..100 finite percent.
 */
export function resolveBulkPurchaseTaxRate(
  mode: CatalogBulkPurchaseTaxMode,
  rateInput: string
): { ok: true; rate: number | null } | { ok: false; error: string } {
  if (mode === "clear") {
    return { ok: true, rate: null };
  }
  const parsed = parseTaxRatePctOrNull(rateInput, "Purchase tax rate");
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }
  if (parsed.value == null) {
    return {
      ok: false,
      error:
        "Purchase tax rate is required to set a value. Choose Clear purchase tax to remove it.",
    };
  }
  return { ok: true, rate: parsed.value };
}

/**
 * Apply a live bulk action to selected ids sequentially via store adapters.
 * Stops on first failure and reports partial progress clearly.
 * Does not handle modal actions (e.g. bulk purchase tax).
 */
export async function applyCatalogBulkAction(options: {
  companyId: string;
  actionId: CatalogBulkImmediateActionId;
  selectedIds: readonly string[];
  adapters: CatalogBulkStoreAdapters;
}): Promise<CatalogBulkApplyResult> {
  const { companyId, actionId, selectedIds, adapters } = options;
  if (!isImmediateActionId(actionId)) {
    return {
      ok: false,
      attemptedCount: 0,
      successCount: 0,
      failedCount: 0,
      errors: ["Unknown bulk action."],
    };
  }
  if (selectedIds.length === 0) {
    return {
      ok: false,
      attemptedCount: 0,
      successCount: 0,
      failedCount: 0,
      errors: ["No catalog items selected."],
    };
  }

  let successCount = 0;
  const errors: string[] = [];

  for (const id of selectedIds) {
    let updated: CatalogItem | null = null;
    if (actionId === "mark_active") {
      updated = await adapters.setActive(id, true, { companyId });
    } else if (actionId === "mark_inactive") {
      updated = await adapters.setActive(id, false, { companyId });
    } else if (actionId === "proposal_visible") {
      updated = await adapters.updateVisibility(id, "customer_visible", {
        companyId,
      });
    } else if (actionId === "proposal_hidden") {
      updated = await adapters.updateVisibility(id, "internal_only", {
        companyId,
      });
    }

    if (!updated) {
      errors.push(`Could not update catalog item ${id}.`);
      return {
        ok: false,
        attemptedCount: selectedIds.length,
        successCount,
        failedCount: 1,
        errors,
      };
    }
    successCount++;
  }

  return {
    ok: true,
    attemptedCount: selectedIds.length,
    successCount,
    failedCount: 0,
    errors: [],
  };
}

/**
 * Apply purchase_tax_rate_pct only to selected items (set number or clear to null).
 * Does not touch sales tax, SKUs, visibility, active, or prices.
 */
export async function applyCatalogBulkPurchaseTax(options: {
  companyId: string;
  selectedIds: readonly string[];
  purchaseTaxRatePct: number | null;
  adapters: CatalogBulkPurchaseTaxAdapters;
}): Promise<CatalogBulkApplyResult> {
  const { companyId, selectedIds, purchaseTaxRatePct, adapters } = options;
  if (selectedIds.length === 0) {
    return {
      ok: false,
      attemptedCount: 0,
      successCount: 0,
      failedCount: 0,
      errors: ["No catalog items selected."],
    };
  }

  let successCount = 0;
  for (const id of selectedIds) {
    const updated = await adapters.updatePurchaseTax(
      id,
      purchaseTaxRatePct,
      { companyId }
    );
    if (!updated) {
      return {
        ok: false,
        attemptedCount: selectedIds.length,
        successCount,
        failedCount: 1,
        errors: [`Could not update catalog item ${id}.`],
      };
    }
    successCount++;
  }

  return {
    ok: true,
    attemptedCount: selectedIds.length,
    successCount,
    failedCount: 0,
    errors: [],
  };
}

export function formatCatalogBulkResultMessage(
  actionId: CatalogBulkImmediateActionId,
  result: CatalogBulkApplyResult
): string {
  const verb =
    actionId === "mark_active"
      ? "activated"
      : actionId === "mark_inactive"
        ? "deactivated"
        : actionId === "proposal_visible"
          ? "set to Visible"
          : "set to Hidden";

  if (result.ok) {
    return `Bulk update complete: ${result.successCount} item${result.successCount === 1 ? "" : "s"} ${verb}.`;
  }
  if (result.successCount > 0) {
    return `Bulk update stopped after ${result.successCount} success${result.successCount === 1 ? "" : "es"} and ${result.failedCount} failure. ${result.errors.join(" ")} Reload Catalog before retrying.`;
  }
  return result.errors[0]
    ? `Bulk update failed. ${result.errors[0]}`
    : "Bulk update failed.";
}

export function formatCatalogBulkPurchaseTaxResultMessage(
  mode: CatalogBulkPurchaseTaxMode,
  result: CatalogBulkApplyResult
): string {
  const verb = mode === "clear" ? "cleared purchase tax on" : "updated purchase tax on";
  if (result.ok) {
    return `Bulk purchase tax complete: ${verb} ${result.successCount} item${result.successCount === 1 ? "" : "s"}.`;
  }
  if (result.successCount > 0) {
    return `Bulk purchase tax stopped after ${result.successCount} success${result.successCount === 1 ? "" : "es"} and ${result.failedCount} failure. ${result.errors.join(" ")} Reload Catalog before retrying.`;
  }
  return result.errors[0]
    ? `Bulk purchase tax failed. ${result.errors[0]}`
    : "Bulk purchase tax failed.";
}
