"use client";

import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import ProposalCustomerPreviewClient from "./ProposalCustomerPreviewClient";

export default function ProposalCustomerPreviewAppPage({
  companyId,
  emailDeliveryConfigured,
}: {
  companyId: string;
  emailDeliveryConfigured: boolean;
}) {
  return (
    <FieldDiveAppShell activeNav="templates">
      <ProposalCustomerPreviewClient
        companyId={companyId}
        emailDeliveryConfigured={emailDeliveryConfigured}
      />
    </FieldDiveAppShell>
  );
}
