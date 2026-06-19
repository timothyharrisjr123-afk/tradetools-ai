"use client";

import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import ProposalCustomerPreviewClient from "./ProposalCustomerPreviewClient";

export default function ProposalCustomerPreviewAppPage({
  companyId,
}: {
  companyId: string;
}) {
  return (
    <FieldDiveAppShell activeNav="templates">
      <ProposalCustomerPreviewClient companyId={companyId} />
    </FieldDiveAppShell>
  );
}
