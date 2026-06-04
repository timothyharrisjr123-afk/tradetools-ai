"use client";

import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import TemplatesSetupPlaceholder from "./TemplatesSetupPlaceholder";

export default function TemplatesAppPage({ companyId: _companyId }: { companyId: string }) {
  return (
    <FieldDiveAppShell activeNav="templates">
      <TemplatesSetupPlaceholder />
    </FieldDiveAppShell>
  );
}
