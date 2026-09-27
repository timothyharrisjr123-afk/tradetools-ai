import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { isProposalEmailDeliveryConfigured } from "@/app/lib/proposalEmailDelivery.server";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import ProposalCustomerPreviewAppPage from "./ProposalCustomerPreviewAppPage";

export const dynamic = "force-dynamic";

export default async function ProposalCustomerPreviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/roofing/proposals/preview");
  }
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  return (
    <ProposalCustomerPreviewAppPage
      companyId={companyId}
      emailDeliveryConfigured={isProposalEmailDeliveryConfigured()}
    />
  );
}
