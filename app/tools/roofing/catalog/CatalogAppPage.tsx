"use client";

import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import CatalogSetupClient from "./CatalogSetupClient";

export default function CatalogAppPage({ companyId }: { companyId: string }) {
  return (
    <FieldDiveAppShell activeNav="catalog">
      <div className="mx-auto w-full max-w-[92rem]">
        <CatalogSetupClient companyId={companyId} />
      </div>
    </FieldDiveAppShell>
  );
}
