"use client";

import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import TemplatesSetupClient from "./TemplatesSetupClient";

export default function TemplatesAppPage({ companyId }: { companyId: string }) {
  return (
    <FieldDiveAppShell activeNav="templates">
      <TemplatesSetupClient companyId={companyId} />
    </FieldDiveAppShell>
  );
}
