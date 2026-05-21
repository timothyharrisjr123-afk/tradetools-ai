import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import CustomersAdminClient from "./CustomersAdminClient";

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/customers");
  }
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    redirect("/login?redirectTo=/admin/customers");
  }

  return <CustomersAdminClient companyId={companyId} />;
}
