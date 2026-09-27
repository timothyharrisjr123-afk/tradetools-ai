import { requireActiveCompanyPage } from "@/app/lib/access/requireActiveCompanyPage";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import CatalogAppPage from "./CatalogAppPage";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/roofing/catalog");
  }
  const { companyId } = await requireActiveCompanyPage(supabase, user);

  return <CatalogAppPage companyId={companyId} />;
}
