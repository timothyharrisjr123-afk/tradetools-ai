import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
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
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    redirect("/login?redirectTo=/tools/roofing/proposals/preview");
  }

  return <ProposalCustomerPreviewAppPage companyId={companyId} />;
}
