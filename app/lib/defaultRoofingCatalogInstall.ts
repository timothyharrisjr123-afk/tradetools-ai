/**
 * Idempotent install of default roofing catalog items into public.catalog_items.
 *
 * Uses passive definitions from defaultRoofingCatalog.ts and catalogStore CRUD only.
 * Does not update existing rows, auto-run on import, or touch pricing/proposals/templates.
 *
 * Stage 3F6A: helper only — not wired from UI yet.
 */

import { buildDefaultRoofingCatalogDrafts } from "@/app/lib/defaultRoofingCatalog";
import { createCatalogItem, getCatalogItemsByCompany } from "@/app/lib/catalogStore";

export type InstallDefaultRoofingCatalogResult = {
  companyId: string;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  createdIds: string[];
  errors?: string[];
};

function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function extractSeedKey(metadata: Record<string, unknown> | null | undefined): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = metadata.seed_key;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildExistingSeedKeySet(
  items: Awaited<ReturnType<typeof getCatalogItemsByCompany>>
): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    const seedKey = extractSeedKey(item.metadata ?? null);
    if (seedKey) keys.add(seedKey);
  }
  return keys;
}

/**
 * Insert missing starter catalog rows for a company (insert-only, seed_key dedupe).
 */
export async function installDefaultRoofingCatalog(
  companyId: string
): Promise<InstallDefaultRoofingCatalogResult | null> {
  const scopedCompanyId = String(companyId || "").trim();
  if (!isUuidLike(scopedCompanyId)) {
    console.error(
      "[defaultRoofingCatalogInstall] installDefaultRoofingCatalog: invalid company id"
    );
    return null;
  }

  const existingItems = await getCatalogItemsByCompany(scopedCompanyId);
  const existingSeedKeys = buildExistingSeedKeySet(existingItems);
  const drafts = buildDefaultRoofingCatalogDrafts(scopedCompanyId);

  const createdIds: string[] = [];
  const errors: string[] = [];
  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const draft of drafts) {
    const seedKey = extractSeedKey(draft.metadata ?? null);
    if (!seedKey) {
      failedCount += 1;
      errors.push("Draft missing metadata.seed_key");
      continue;
    }

    if (existingSeedKeys.has(seedKey)) {
      skippedCount += 1;
      continue;
    }

    const created = await createCatalogItem(draft);
    if (created?.id) {
      createdCount += 1;
      createdIds.push(created.id);
      existingSeedKeys.add(seedKey);
    } else {
      failedCount += 1;
      errors.push(`Failed to create catalog item: ${seedKey}`);
      console.error(
        "[defaultRoofingCatalogInstall] createCatalogItem failed:",
        { companyId: scopedCompanyId, seedKey }
      );
    }
  }

  const result: InstallDefaultRoofingCatalogResult = {
    companyId: scopedCompanyId,
    createdCount,
    skippedCount,
    failedCount,
    createdIds,
  };

  if (errors.length > 0) {
    result.errors = errors;
  }

  if (createdCount === 0 && failedCount > 0) {
    console.error(
      "[defaultRoofingCatalogInstall] installDefaultRoofingCatalog: all creates failed",
      { companyId: scopedCompanyId, failedCount, errors }
    );
  }

  return result;
}
