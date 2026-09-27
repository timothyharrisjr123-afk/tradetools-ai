import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import ProposalBuilderAppPage from "./ProposalBuilderAppPage";

export const dynamic = "force-dynamic";

export default async function ProposalBuilderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/roofing/proposals/builder");
  }
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  return <ProposalBuilderAppPage companyId={companyId} />;
}
