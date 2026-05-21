import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import PriceBookAdminClient from "./PriceBookAdminClient";

export default async function PriceBookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/price-book");
  }
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    redirect("/login?redirectTo=/admin/price-book");
  }

  return <PriceBookAdminClient companyId={companyId} />;
}
