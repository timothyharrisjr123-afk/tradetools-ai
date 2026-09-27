import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import TemplatesAppPage from "./TemplatesAppPage";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/roofing/templates");
  }
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  return <TemplatesAppPage companyId={companyId} />;
}
