"use client";

import CatalogAdminClient from "@/app/admin/catalog/CatalogAdminClient";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";

export default function CatalogAppPage({ companyId }: { companyId: string }) {
  return (
    <FieldDiveAppShell activeNav="catalog">
      <div className="mx-auto w-full max-w-[92rem]">
        <CatalogAdminClient companyId={companyId} showAdminNav={false} />
      </div>
    </FieldDiveAppShell>
  );
}
