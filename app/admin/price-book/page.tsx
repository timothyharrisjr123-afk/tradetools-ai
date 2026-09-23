import { redirect } from "next/navigation";

/**
 * Phase 3 — legacy /admin/price-book (service_items) retired.
 * Canonical pricing shelf: /tools/roofing/catalog (catalog_items).
 */
export default function PriceBookRetiredPage() {
  redirect("/tools/roofing/catalog");
}
