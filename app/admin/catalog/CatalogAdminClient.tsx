"use client";

import AdminNavLinks from "@/app/admin/AdminNavLinks";
import CatalogSetupClient from "@/app/tools/roofing/catalog/CatalogSetupClient";

/**
 * Admin catalog entry — same workspace as /tools/roofing/catalog.
 * /admin/catalog redirects to the tools route; this client remains for
 * showAdminNav embeds or future admin-only shells.
 */
export default function CatalogAdminClient({
  companyId,
  showAdminNav = true,
}: {
  companyId: string;
  showAdminNav?: boolean;
}) {
  return (
    <div className="w-full space-y-6 text-slate-900">
      {showAdminNav ? <AdminNavLinks current="catalog" /> : null}
      <CatalogSetupClient companyId={companyId} />
    </div>
  );
}
