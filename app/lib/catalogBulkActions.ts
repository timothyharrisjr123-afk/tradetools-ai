/**
 * Catalog bulk actions — definitions + sequential apply via store adapters.
 * No DB access here. Active actions use validated store update paths only.
 */

import type { CatalogItem, CustomerVisibility } from "@/app/lib/catalogTypes";

export type CatalogBulkActionStatus = "live" | "planned";

export type CatalogBulkLiveActionId =
  | "mark_active"
  | "mark_inactive"
  | "proposal_visible"
  | "proposal_hidden";

export type CatalogBulkPlannedActionId =
  | "bulk_purchase_tax"
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

/** Live v1 bulk actions — store-backed, company-scoped. */
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
] as const;

/** Planned bulk workflows — visible, disabled, not fake-active. */
export const CATALOG_BULK_PLANNED_ACTIONS: readonly CatalogBulkActionDef[] = [
  {
    id: "bulk_purchase_tax",
    label: "Bulk edit purchase tax",
    detail: "Set material purchase tax on many items — Planned",
    status: "planned",
  },
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

function isLiveActionId(id: string): id is CatalogBulkLiveActionId {
  return (
    id === "mark_active" ||
    id === "mark_inactive" ||
    id === "proposal_visible" ||
    id === "proposal_hidden"
  );
}

/**
 * Apply a live bulk action to selected ids sequentially via store adapters.
 * Stops on first failure and reports partial progress clearly.
 */
export async function applyCatalogBulkAction(options: {
  companyId: string;
  actionId: CatalogBulkLiveActionId;
  selectedIds: readonly string[];
  adapters: CatalogBulkStoreAdapters;
}): Promise<CatalogBulkApplyResult> {
  const { companyId, actionId, selectedIds, adapters } = options;
  if (!isLiveActionId(actionId)) {
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

export function formatCatalogBulkResultMessage(
  actionId: CatalogBulkLiveActionId,
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
