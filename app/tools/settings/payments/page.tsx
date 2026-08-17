import { ensureUserIdentity, getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsPaymentsClient from "./SettingsPaymentsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/tools/settings/payments");
  }
  await ensureUserIdentity(supabase, user);
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    redirect("/login?redirectTo=/tools/settings/payments");
  }

  return <SettingsPaymentsClient />;
}
