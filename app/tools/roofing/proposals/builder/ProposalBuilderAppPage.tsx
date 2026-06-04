"use client";

import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import ProposalBuilderClient from "./ProposalBuilderClient";

export default function ProposalBuilderAppPage({ companyId }: { companyId: string }) {
  return (
    <FieldDiveAppShell activeNav="templates">
      <ProposalBuilderClient companyId={companyId} />
    </FieldDiveAppShell>
  );
}
